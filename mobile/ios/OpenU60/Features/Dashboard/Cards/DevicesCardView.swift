import SwiftUI

struct DevicesCardView: View {
    let connectedDevices: [ConnectedDevice]
    @Binding var showAllDevices: Bool

    var body: some View {
        CardView {
            VStack(alignment: .leading, spacing: 8) {
                Button {
                    withAnimation { showAllDevices.toggle() }
                } label: {
                    HStack {
                        Label("Connected Devices", systemImage: "laptopcomputer.and.iphone")
                            .font(.headline)
                        Spacer()
                        AnimatedNumber(value: connectedDevices.count,
                                       font: .title3.weight(.bold), textColor: .primary)
                        Image(systemName: showAllDevices ? "chevron.up" : "chevron.down")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(.plain)

                if showAllDevices {
                    Divider()
                    ForEach(connectedDevices) { device in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(device.displayName)
                                .font(.subheadline.bold())
                            HStack {
                                Text(device.macAddress)
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(.secondary)
                                Spacer()
                                if !device.ipAddress.isEmpty {
                                    Text(device.ipAddress)
                                        .font(.caption2.monospaced())
                                        .foregroundStyle(.secondary)
                                }
                            }
                            if let ipv6 = device.ip6Addresses.first(where: { !$0.hasPrefix("fe80") }) {
                                Text(ipv6)
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                                    .truncationMode(.middle)
                            }
                        }
                        .padding(.vertical, 2)
                        if device.id != connectedDevices.last?.id {
                            Divider()
                        }
                    }
                }
            }
        }
    }
}
