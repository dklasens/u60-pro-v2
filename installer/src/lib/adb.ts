const CMD_CNXN = 0x4e584e43;
const CMD_AUTH = 0x48545541;
const CMD_OPEN = 0x4e45504f;
const CMD_OKAY = 0x59414b4f;
const CMD_WRTE = 0x45545257;
const CMD_CLSE = 0x45534c43;

const AUTH_RSAPUBLICKEY = 3;
const VERSION = 0x01000001;
const MAX_DATA = 256 * 1024;
const USB_TIMEOUT_MS = 10_000;

interface ADBMessage {
  cmd: number;
  arg0: number;
  arg1: number;
  dataLen: number;
  data: Uint8Array;
}

function checksum(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return sum & 0xffffffff;
}

function buildMessage(
  cmd: number,
  arg0: number,
  arg1: number,
  data: Uint8Array | null
): Uint8Array {
  const header = new ArrayBuffer(24);
  const dv = new DataView(header);
  dv.setUint32(0, cmd, true);
  dv.setUint32(4, arg0, true);
  dv.setUint32(8, arg1, true);
  dv.setUint32(12, data ? data.length : 0, true);
  dv.setUint32(16, data ? checksum(data) : 0, true);
  dv.setUint32(20, (cmd ^ 0xffffffff) >>> 0, true);

  if (data && data.length > 0) {
    const full = new Uint8Array(24 + data.length);
    full.set(new Uint8Array(header), 0);
    full.set(data, 24);
    return full;
  }
  return new Uint8Array(header);
}

function parseMessage(
  buffer: ArrayBuffer
): Omit<ADBMessage, "data"> | null {
  if (buffer.byteLength < 24) return null;
  const dv = new DataView(buffer);
  return {
    cmd: dv.getUint32(0, true),
    arg0: dv.getUint32(4, true),
    arg1: dv.getUint32(8, true),
    dataLen: dv.getUint32(12, true),
  };
}

export class ADBClient {
  private device: USBDevice | null = null;
  private iface: number | null = null;
  private epIn: number | null = null;
  private epOut: number | null = null;
  private localIdCounter = 0;

  private async send(data: Uint8Array): Promise<void> {
    const result = await Promise.race([
      this.device!.transferOut(this.epOut!, data as unknown as BufferSource),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(
          "USB transfer timed out. Device not responding — try replugging the USB cable."
        )), USB_TIMEOUT_MS)
      ),
    ]);
    if (result.status !== "ok") {
      throw new Error("USB write failed: " + result.status);
    }
  }

  private async recv(): Promise<ArrayBuffer> {
    const result = await Promise.race([
      this.device!.transferIn(this.epIn!, 64 * 1024),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(
          "USB transfer timed out. Device not responding — try replugging the USB cable."
        )), USB_TIMEOUT_MS)
      ),
    ]);
    return result.data!.buffer as ArrayBuffer;
  }

  private async recvMessage(): Promise<ADBMessage> {
    const headerBuf = await this.recv();
    const msg = parseMessage(headerBuf);
    if (!msg) throw new Error("Failed to parse ADB message header");

    let payload = new Uint8Array(0);

    if (headerBuf.byteLength > 24) {
      payload = new Uint8Array(headerBuf, 24);
    } else if (msg.dataLen > 0) {
      const dataBuf = await this.recv();
      payload = new Uint8Array(dataBuf);
    }

    return { ...msg, data: payload };
  }

  private async sendMessage(
    cmd: number,
    arg0: number,
    arg1: number,
    data: Uint8Array | null
  ): Promise<void> {
    const msg = buildMessage(cmd, arg0, arg1, data);
    await this.send(msg);
  }

  async connect(): Promise<void> {
    const device = await navigator.usb.requestDevice({
      filters: [
        { classCode: 0xff, subclassCode: 0x42, protocolCode: 0x01 },
      ],
    });
    await this.connectDevice(device);
  }

  async connectDevice(device: USBDevice): Promise<void> {
    this.device = device;
    await this.device.open();

    if (this.device.configuration === null) {
      await this.device.selectConfiguration(1);
    }

    let found = false;
    for (const iface of this.device.configuration!.interfaces) {
      for (const alt of iface.alternates) {
        if (
          alt.interfaceClass === 0xff &&
          alt.interfaceSubclass === 0x42 &&
          alt.interfaceProtocol === 0x01
        ) {
          this.iface = iface.interfaceNumber;
          for (const ep of alt.endpoints) {
            if (ep.direction === "in") this.epIn = ep.endpointNumber;
            if (ep.direction === "out") this.epOut = ep.endpointNumber;
          }
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!found || this.epIn === null || this.epOut === null) {
      throw new Error(
        "ADB interface not found on USB device. Is ADB enabled?"
      );
    }

    await this.device.claimInterface(this.iface!);

    const banner = new TextEncoder().encode("host::\0");
    await this.sendMessage(CMD_CNXN, VERSION, MAX_DATA, banner);

    let response = await this.recvMessage();

    if (response.cmd === CMD_AUTH) {
      const dummyKey = new TextEncoder().encode(
        "QAAAADummy==\0 unknown@host\0"
      );
      await this.sendMessage(CMD_AUTH, AUTH_RSAPUBLICKEY, 0, dummyKey);
      response = await this.recvMessage();
    }

    if (response.cmd !== CMD_CNXN) {
      throw new Error(
        "ADB connection handshake failed. Check USB connection."
      );
    }
  }

  async shell(command: string): Promise<string> {
    const localId = ++this.localIdCounter;
    const cmdData = new TextEncoder().encode("shell:" + command + "\0");
    await this.sendMessage(CMD_OPEN, localId, 0, cmdData);

    let msg = await this.recvMessage();
    if (msg.cmd !== CMD_OKAY) {
      throw new Error("Failed to open ADB shell stream");
    }
    const remoteId = msg.arg0;

    let output = "";
    const decoder = new TextDecoder();
    while (true) {
      msg = await this.recvMessage();
      if (msg.cmd === CMD_WRTE) {
        output += decoder.decode(msg.data);
        await this.sendMessage(CMD_OKAY, localId, remoteId, null);
      } else if (msg.cmd === CMD_CLSE) {
        await this.sendMessage(CMD_CLSE, localId, remoteId, null);
        break;
      }
    }
    return output;
  }

  async push(
    fileData: Uint8Array,
    remotePath: string,
    mode: number
  ): Promise<void> {
    const localId = ++this.localIdCounter;
    const syncCmd = new TextEncoder().encode("sync:\0");
    await this.sendMessage(CMD_OPEN, localId, 0, syncCmd);

    let msg = await this.recvMessage();
    if (msg.cmd !== CMD_OKAY) {
      throw new Error("Failed to open ADB sync stream");
    }
    const remoteId = msg.arg0;

    const pathMode = remotePath + "," + mode;
    const pathModeBytes = new TextEncoder().encode(pathMode);
    const sendHeader = new Uint8Array(8 + pathModeBytes.length);
    sendHeader.set(new TextEncoder().encode("SEND"), 0);
    new DataView(sendHeader.buffer).setUint32(4, pathModeBytes.length, true);
    sendHeader.set(pathModeBytes, 8);

    await this.sendMessage(CMD_WRTE, localId, remoteId, sendHeader);
    msg = await this.recvMessage();
    if (msg.cmd !== CMD_OKAY) throw new Error("SEND rejected by device");

    const CHUNK_SIZE = 64 * 1024;
    for (let offset = 0; offset < fileData.length; offset += CHUNK_SIZE) {
      const end = Math.min(offset + CHUNK_SIZE, fileData.length);
      const chunk = fileData.slice(offset, end);
      const dataPacket = new Uint8Array(8 + chunk.length);
      dataPacket.set(new TextEncoder().encode("DATA"), 0);
      new DataView(dataPacket.buffer).setUint32(4, chunk.length, true);
      dataPacket.set(chunk, 8);

      await this.sendMessage(CMD_WRTE, localId, remoteId, dataPacket);
      msg = await this.recvMessage();
      if (msg.cmd !== CMD_OKAY)
        throw new Error("DATA chunk rejected by device");
    }

    const donePacket = new Uint8Array(8);
    donePacket.set(new TextEncoder().encode("DONE"), 0);
    new DataView(donePacket.buffer).setUint32(
      4,
      Math.floor(Date.now() / 1000),
      true
    );

    await this.sendMessage(CMD_WRTE, localId, remoteId, donePacket);
    msg = await this.recvMessage();
    if (msg.cmd !== CMD_OKAY) throw new Error("DONE rejected by device");

    msg = await this.recvMessage();
    if (msg.cmd === CMD_WRTE) {
      const resp = new TextDecoder().decode(msg.data).substring(0, 4);
      if (resp === "FAIL") {
        const errLen = new DataView(
          msg.data.buffer,
          msg.data.byteOffset + 4
        ).getUint32(0, true);
        const errMsg = new TextDecoder().decode(
          msg.data.slice(8, 8 + errLen)
        );
        throw new Error("Push failed: " + errMsg);
      }
      await this.sendMessage(CMD_OKAY, localId, remoteId, null);
    }

    await this.sendMessage(CMD_CLSE, localId, remoteId, null);
  }
}
