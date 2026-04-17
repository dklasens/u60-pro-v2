export interface DeviceSpec {
  label: string;
  value: string;
}

export interface BandInfo {
  type: string;
  bands: string;
}

export const deviceSpecs: DeviceSpec[] = [
  { label: "Chipset", value: "Qualcomm Snapdragon X75" },
  { label: "CPU", value: "4x Cortex-A55 @ 2.2 GHz" },
  { label: "Modem", value: "5G-A Sub-6 + mmWave" },
  { label: "WiFi", value: "WiFi 7 (802.11be), EHT160" },
  { label: "Battery", value: "10,000\u00a0mAh" },
  { label: "Display", value: '3.5" IPS LCD touchscreen' },
  { label: "RAM", value: "1.6\u00a0GB" },
  { label: "Storage", value: "8\u00a0GB eMMC" },
  { label: "OS", value: "OpenWrt 23.05 (ZWRT)" },
  { label: "USB", value: "USB-C (PD, OTG)" },
];

export const bandInfo: BandInfo[] = [
  {
    type: "NR (5G)",
    bands:
      "n1, n2, n3, n5, n7, n8, n18, n20, n26, n28, n29, n38, n40, n41, n48, n66, n71, n75, n77, n78, n79",
  },
  {
    type: "LTE",
    bands:
      "B1, B2, B3, B4, B5, B7, B8, B18, B19, B20, B26, B28, B29, B32, B34, B38, B39, B40, B41, B42, B43, B48, B66, B71",
  },
];
