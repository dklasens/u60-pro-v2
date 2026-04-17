import SwiftUI

struct CellularCardView: View {
    let wanIPv4: String
    let wanIPv6: String
    let speed: TrafficSpeed
    let trafficStats: TrafficStats

    var body: some View {
        CardView {
            VStack(alignment: .leading, spacing: 10) {
                Text("Cellular Connection")
                    .font(.headline)

                if !wanIPv4.isEmpty {
                    HStack {
                        Text("WAN IP")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(wanIPv4)
                            .font(.caption.monospacedDigit())
                    }
                }
                if !wanIPv6.isEmpty {
                    HStack {
                        Text("WAN IPv6")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(wanIPv6)
                            .font(.caption2.monospacedDigit())
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                }

                Divider()

                HStack {
                    VStack(spacing: 4) {
                        Image(systemName: "arrow.down.circle.fill")
                            .foregroundStyle(.green)
                        let dl = DeviceParser.speedComponents(speed.downloadBytesPerSec)
                        HStack(spacing: 0) {
                            AnimatedNumber(value: dl.number, decimalPlaces: dl.decimalPlaces,
                                           font: .title3.weight(.bold), textColor: .primary)
                            Text(dl.unit)
                                .font(.title3.weight(.bold).monospacedDigit())
                                .contentTransition(.opacity)
                                .animation(.easeInOut(duration: 0.4), value: dl.unit)
                        }
                        Text("Download")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)

                    Divider()

                    VStack(spacing: 4) {
                        Image(systemName: "arrow.up.circle.fill")
                            .foregroundStyle(.blue)
                        let ul = DeviceParser.speedComponents(speed.uploadBytesPerSec)
                        HStack(spacing: 0) {
                            AnimatedNumber(value: ul.number, decimalPlaces: ul.decimalPlaces,
                                           font: .title3.weight(.bold), textColor: .primary)
                            Text(ul.unit)
                                .font(.title3.weight(.bold).monospacedDigit())
                                .contentTransition(.opacity)
                                .animation(.easeInOut(duration: 0.4), value: ul.unit)
                        }
                        Text("Upload")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                }

                Divider()

                HStack {
                    Text("Total DL")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    let dlTotal = DeviceParser.bytesComponents(trafficStats.rxBytes)
                    HStack(spacing: 0) {
                        AnimatedNumber(value: dlTotal.number, decimalPlaces: dlTotal.decimalPlaces,
                                       font: .caption, textColor: .primary)
                        Text(dlTotal.unit)
                            .font(.caption.monospacedDigit())
                            .contentTransition(.opacity)
                            .animation(.easeInOut(duration: 0.4), value: dlTotal.unit)
                    }
                }
                HStack {
                    Text("Total UL")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    let ulTotal = DeviceParser.bytesComponents(trafficStats.txBytes)
                    HStack(spacing: 0) {
                        AnimatedNumber(value: ulTotal.number, decimalPlaces: ulTotal.decimalPlaces,
                                       font: .caption, textColor: .primary)
                        Text(ulTotal.unit)
                            .font(.caption.monospacedDigit())
                            .contentTransition(.opacity)
                            .animation(.easeInOut(duration: 0.4), value: ulTotal.unit)
                    }
                }
            }
        }
    }
}
