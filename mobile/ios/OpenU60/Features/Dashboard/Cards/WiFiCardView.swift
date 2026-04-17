import SwiftUI

struct WiFiCardView: View {
    let wifiStatus: WifiStatus
    @Binding var showWiFiShare: Bool

    var body: some View {
        CardView {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("WiFi")
                        .font(.headline)
                    if wifiStatus.wifiOn && wifiStatus.wifi6 {
                        Text("WiFi 7")
                            .font(.caption2.bold())
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.blue.opacity(0.15), in: Capsule())
                            .foregroundStyle(.blue)
                    }
                    if wifiStatus.wifiOn && wifiStatus.clientsTotal > 0 {
                        HStack(spacing: 2) {
                            AnimatedNumber(value: wifiStatus.clientsTotal,
                                           font: .caption2, textColor: .secondary)
                            Text("client\(wifiStatus.clientsTotal == 1 ? "" : "s")")
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    Text(wifiStatus.wifiOn ? "On" : "Off")
                        .font(.caption)
                        .foregroundStyle(wifiStatus.wifiOn ? .green : .red)
                }

                if wifiStatus.wifiOn {
                    wifiBandRow(
                        label: "2.4G",
                        disabled: wifiStatus.radio2gDisabled,
                        ssid: wifiStatus.ssid2g,
                        hidden: wifiStatus.hidden2g,
                        encryption: wifiStatus.encryption2g,
                        channel: wifiStatus.channel2g
                    )
                    wifiBandRow(
                        label: "5G",
                        disabled: wifiStatus.radio5gDisabled,
                        ssid: wifiStatus.ssid5g,
                        hidden: wifiStatus.hidden5g,
                        encryption: wifiStatus.encryption5g,
                        channel: wifiStatus.channel5g
                    )

                    if wifiStatus.guestEnabled {
                        HStack {
                            Label("Guest", systemImage: "wifi.exclamationmark")
                                .font(.caption)
                            Spacer()
                            Text(wifiStatus.guestSsid)
                                .font(.caption.bold())
                                .lineLimit(1)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .onTapGesture {
            guard wifiStatus.wifiOn else { return }
            withAnimation { showWiFiShare.toggle() }
        }
    }

    private func wifiBandRow(
        label: String, disabled: Bool, ssid: String, hidden: Bool,
        encryption: String, channel: String
    ) -> some View {
        HStack {
            Label(label, systemImage: "wifi")
                .font(.caption)
            Spacer()
            if disabled {
                Text("Disabled")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                if hidden {
                    Text("(Hidden)")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }
                if !ssid.isEmpty {
                    Text(ssid)
                        .font(.caption.bold())
                        .lineLimit(1)
                }
                if !encryption.isEmpty {
                    Text(encryption)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                if !channel.isEmpty {
                    Text("CH \(channel)")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}
