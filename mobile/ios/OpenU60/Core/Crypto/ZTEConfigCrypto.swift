import Foundation
import CommonCrypto
import CryptoKit

/// AES encryption/decryption for ZTE config files using CommonCrypto.
enum ZTEConfigCrypto {

    // MARK: - Header Parsing

    static func parseHeader(data: Data) -> ConfigHeader? {
        guard data.count >= ConfigConstants.headerSize else { return nil }
        let magicBytes = data.subdata(in: 0..<4)
        let magic = String(data: magicBytes, encoding: .ascii) ?? ""
        guard magic == ConfigConstants.headerMagic else { return nil }

        let payloadTypeByte = data[ConfigConstants.payloadTypeOffset]
        let payloadType = PayloadType(rawValue: payloadTypeByte) ?? .ecb

        // Extract signature (null-terminated string at offset 8, max 64 bytes)
        let sigStart = ConfigConstants.signatureOffset
        let sigEnd = min(sigStart + ConfigConstants.signatureMaxLen, data.count)
        let sigData = data.subdata(in: sigStart..<sigEnd)
        var signature = ""
        if let nullIndex = sigData.firstIndex(of: 0) {
            let sigSlice = sigData[sigData.startIndex..<nullIndex]
            signature = String(data: sigSlice, encoding: .ascii) ?? ""
        } else {
            signature = String(data: sigData, encoding: .ascii) ?? ""
        }

        // Payload offset (4-byte big-endian at offset 72)
        let offsetStart = ConfigConstants.payloadOffsetField
        let payloadOffset: UInt32 = data.subdata(in: offsetStart..<(offsetStart + 4))
            .withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }

        return ConfigHeader(
            magic: magic,
            payloadType: payloadType,
            signature: signature,
            payloadOffset: payloadOffset == 0 ? UInt32(ConfigConstants.headerSize) : payloadOffset
        )
    }

    static func buildHeader(payloadType: PayloadType, signature: String, payloadOffset: UInt32 = 128) -> Data {
        var header = Data(count: ConfigConstants.headerSize)
        // Magic
        header.replaceSubrange(0..<4, with: Data(ConfigConstants.headerMagic.utf8))
        // Payload type
        header[ConfigConstants.payloadTypeOffset] = payloadType.rawValue
        // Signature
        let sigData = Data(signature.utf8)
        let sigLen = min(sigData.count, ConfigConstants.signatureMaxLen)
        header.replaceSubrange(ConfigConstants.signatureOffset..<(ConfigConstants.signatureOffset + sigLen), with: sigData.prefix(sigLen))
        // Payload offset
        var beOffset = payloadOffset.bigEndian
        header.replaceSubrange(ConfigConstants.payloadOffsetField..<(ConfigConstants.payloadOffsetField + 4),
                               with: Data(bytes: &beOffset, count: 4))
        return header
    }

    // MARK: - AES-128-ECB

    static func decryptECB(data: Data, key: Data) -> Data? {
        let adjustedKey = adjustKey(key, targetSize: ConfigConstants.aes128KeySize)
        let bufferSize = data.count + kCCBlockSizeAES128
        var buffer = Data(count: bufferSize)
        var numBytesDecrypted = 0

        let status = buffer.withUnsafeMutableBytes { bufferPtr in
            data.withUnsafeBytes { dataPtr in
                adjustedKey.withUnsafeBytes { keyPtr in
                    CCCrypt(
                        CCOperation(kCCDecrypt),
                        CCAlgorithm(kCCAlgorithmAES128),
                        CCOptions(kCCOptionECBMode | kCCOptionPKCS7Padding),
                        keyPtr.baseAddress, ConfigConstants.aes128KeySize,
                        nil,
                        dataPtr.baseAddress, data.count,
                        bufferPtr.baseAddress, bufferSize,
                        &numBytesDecrypted
                    )
                }
            }
        }

        guard status == kCCSuccess else { return nil }
        return buffer.prefix(numBytesDecrypted)
    }

    static func encryptECB(data: Data, key: Data) -> Data? {
        let adjustedKey = adjustKey(key, targetSize: ConfigConstants.aes128KeySize)
        let bufferSize = data.count + kCCBlockSizeAES128 * 2
        var buffer = Data(count: bufferSize)
        var numBytesEncrypted = 0

        let status = buffer.withUnsafeMutableBytes { bufferPtr in
            data.withUnsafeBytes { dataPtr in
                adjustedKey.withUnsafeBytes { keyPtr in
                    CCCrypt(
                        CCOperation(kCCEncrypt),
                        CCAlgorithm(kCCAlgorithmAES128),
                        CCOptions(kCCOptionECBMode | kCCOptionPKCS7Padding),
                        keyPtr.baseAddress, ConfigConstants.aes128KeySize,
                        nil,
                        dataPtr.baseAddress, data.count,
                        bufferPtr.baseAddress, bufferSize,
                        &numBytesEncrypted
                    )
                }
            }
        }

        guard status == kCCSuccess else { return nil }
        return buffer.prefix(numBytesEncrypted)
    }

    // MARK: - AES-256-CBC

    static func decryptCBC(data: Data, key: Data) -> Data? {
        guard data.count >= ConfigConstants.cbcIVSize + ConfigConstants.aesBlockSize else { return nil }
        let adjustedKey = adjustKey(key, targetSize: ConfigConstants.aes256KeySize)
        let iv = data.prefix(ConfigConstants.cbcIVSize)
        let ciphertext = data.dropFirst(ConfigConstants.cbcIVSize)

        let bufferSize = ciphertext.count + kCCBlockSizeAES128
        var buffer = Data(count: bufferSize)
        var numBytesDecrypted = 0

        let status = buffer.withUnsafeMutableBytes { bufferPtr in
            ciphertext.withUnsafeBytes { dataPtr in
                adjustedKey.withUnsafeBytes { keyPtr in
                    iv.withUnsafeBytes { ivPtr in
                        CCCrypt(
                            CCOperation(kCCDecrypt),
                            CCAlgorithm(kCCAlgorithmAES128),
                            CCOptions(kCCOptionPKCS7Padding),
                            keyPtr.baseAddress, ConfigConstants.aes256KeySize,
                            ivPtr.baseAddress,
                            dataPtr.baseAddress, ciphertext.count,
                            bufferPtr.baseAddress, bufferSize,
                            &numBytesDecrypted
                        )
                    }
                }
            }
        }

        guard status == kCCSuccess else { return nil }
        return buffer.prefix(numBytesDecrypted)
    }

    static func encryptCBC(data: Data, key: Data, iv: Data? = nil) -> Data? {
        let adjustedKey = adjustKey(key, targetSize: ConfigConstants.aes256KeySize)
        let actualIV: Data
        if let iv = iv {
            actualIV = iv.prefix(ConfigConstants.cbcIVSize)
        } else {
            var randomBytes = [UInt8](repeating: 0, count: ConfigConstants.cbcIVSize)
            _ = SecRandomCopyBytes(kSecRandomDefault, ConfigConstants.cbcIVSize, &randomBytes)
            actualIV = Data(randomBytes)
        }

        let bufferSize = data.count + kCCBlockSizeAES128 * 2
        var buffer = Data(count: bufferSize)
        var numBytesEncrypted = 0

        let status = buffer.withUnsafeMutableBytes { bufferPtr in
            data.withUnsafeBytes { dataPtr in
                adjustedKey.withUnsafeBytes { keyPtr in
                    actualIV.withUnsafeBytes { ivPtr in
                        CCCrypt(
                            CCOperation(kCCEncrypt),
                            CCAlgorithm(kCCAlgorithmAES128),
                            CCOptions(kCCOptionPKCS7Padding),
                            keyPtr.baseAddress, ConfigConstants.aes256KeySize,
                            ivPtr.baseAddress,
                            dataPtr.baseAddress, data.count,
                            bufferPtr.baseAddress, bufferSize,
                            &numBytesEncrypted
                        )
                    }
                }
            }
        }

        guard status == kCCSuccess else { return nil }
        return actualIV + buffer.prefix(numBytesEncrypted)
    }

    // MARK: - Key Derivation

    static func keyFromSerial(_ serial: String) -> Data {
        let serialData = Data(serial.utf8)
        let digest = Insecure.MD5.hash(data: serialData)
        return Data(digest.prefix(16))
    }

    static func keyFromSignature(_ signature: String) -> Data {
        let sigData = Data(signature.utf8)
        let digest = Insecure.MD5.hash(data: sigData)
        return Data(digest.prefix(16))
    }

    /// Gather all candidate keys including derived ones.
    static func allCandidateKeys(serial: String? = nil, signature: String? = nil) -> [KnownKey] {
        var keys: [KnownKey] = []
        if let sig = signature, !sig.isEmpty {
            keys.append(KnownKey(description: "Derived from signature", keyBytes: keyFromSignature(sig)))
        }
        if let ser = serial, !ser.isEmpty {
            keys.append(KnownKey(description: "Derived from serial \(ser)", keyBytes: keyFromSerial(ser)))
        }
        keys.append(contentsOf: ConfigConstants.knownKeys)
        return keys
    }

    /// Try to decrypt a payload with all candidate keys.
    static func tryDecrypt(
        payload: Data,
        payloadType: PayloadType,
        serial: String? = nil,
        signature: String? = nil
    ) -> (Data, KnownKey)? {
        let keys = allCandidateKeys(serial: serial, signature: signature)
        for key in keys {
            let result: Data?
            switch payloadType {
            case .ecb:
                result = decryptECB(data: payload, key: key.keyBytes)
            case .cbc, .cbcNew:
                result = decryptCBC(data: payload, key: key.keyBytes)
            case .plain:
                return (payload, key)
            }
            if let decrypted = result, looksLikeValidPayload(decrypted) {
                return (decrypted, key)
            }
        }
        return nil
    }

    /// Basic heuristic: valid decrypted payloads usually start with zlib header or XML.
    private static func looksLikeValidPayload(_ data: Data) -> Bool {
        guard data.count >= 2 else { return false }
        // ZLIB header: 0x78 0x01, 0x78 0x5E, 0x78 0x9C, 0x78 0xDA
        if data[0] == 0x78 && [0x01, 0x5E, 0x9C, 0xDA].contains(data[1]) {
            return true
        }
        // Chunked ZLIB: first 4 bytes = big-endian length, then zlib header
        if data.count >= 6 {
            let chunkLen = UInt32(data[0]) << 24 | UInt32(data[1]) << 16 | UInt32(data[2]) << 8 | UInt32(data[3])
            if chunkLen > 0 && chunkLen < UInt32(data.count) {
                if data[4] == 0x78 { return true }
            }
        }
        // XML header
        if let str = String(data: data.prefix(10), encoding: .utf8) {
            if str.hasPrefix("<?xml") || str.hasPrefix("<") { return true }
        }
        return false
    }

    // MARK: - Helpers

    private static func adjustKey(_ key: Data, targetSize: Int) -> Data {
        if key.count >= targetSize {
            return key.prefix(targetSize)
        }
        var padded = key
        padded.append(contentsOf: [UInt8](repeating: 0, count: targetSize - key.count))
        return padded
    }
}
