import SwiftUI

struct SignalCardView: View {
    let operatorInfo: OperatorInfo
    let nrSignal: NRSignal
    let lteSignal: LTESignal
    var isAirplaneMode: Bool = false

    var body: some View {
        let showNR = operatorInfo.showNR(nr: nrSignal)
        let showLTE = operatorInfo.showLTE(lte: lteSignal)

        CardView {
            VStack(alignment: .leading, spacing: 8) {
                Text("Signal")
                    .font(.headline)

                if showNR {
                    carrierRow(
                        icon: "antenna.radiowaves.left.and.right", tech: "5G NR",
                        band: nrSignal.band, freq: BandConfig.nrFrequency(band: nrSignal.band),
                        technology: .nr, bandwidth: nrSignal.bandwidth,
                        isSCC: false, rsrp: nrSignal.rsrp, sinr: nrSignal.sinr,
                        pci: nrSignal.pci
                    )
                    ForEach(nrSignal.sccCarriers) { scc in
                        carrierRow(
                            icon: "antenna.radiowaves.left.and.right", tech: "5G NR",
                            band: scc.band, freq: BandConfig.nrFrequency(band: scc.band),
                            technology: .nr, bandwidth: scc.bandwidth,
                            isSCC: true, rsrp: scc.rsrp, sinr: scc.sinr,
                            pci: scc.pci
                        )
                    }
                }

                if showLTE {
                    if showNR { Divider() }
                    carrierRow(
                        icon: "cellularbars", tech: "LTE",
                        band: lteSignal.band, freq: BandConfig.lteFrequency(band: lteSignal.band),
                        technology: .lte, bandwidth: lteSignal.bandwidth,
                        isSCC: false, rsrp: lteSignal.rsrp, sinr: lteSignal.sinr,
                        pci: lteSignal.pci
                    )
                    if lteSignal.caState != "0" {
                        ForEach(lteSignal.sccCarriers) { scc in
                            carrierRow(
                                icon: "cellularbars", tech: "LTE",
                                band: scc.band, freq: BandConfig.lteFrequency(band: scc.band),
                                technology: .lte, bandwidth: scc.bandwidth,
                                isSCC: true, rsrp: scc.rsrp, sinr: scc.sinr,
                                pci: scc.pci
                            )
                        }
                    }
                }

                if !showNR && !showLTE {
                    if isAirplaneMode {
                        Label("Airplane Mode", systemImage: "airplane")
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("No signal data")
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .animation(.smooth, value: nrSignal.sccCarriers.map(\.id))
            .animation(.smooth, value: lteSignal.sccCarriers.map(\.id))
            .animation(.smooth, value: showNR)
            .animation(.smooth, value: showLTE)
        }
    }

    @ViewBuilder
    private func carrierRow(
        icon: String, tech: String, band: String, freq: String?,
        technology: BandTechnology, bandwidth: String,
        isSCC: Bool, rsrp: Double?, sinr: Double?, pci: String
    ) -> some View {
        let spec = technology.spec(for: band)
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Label {
                    HStack(spacing: 4) {
                        if band.isEmpty {
                            Text(tech)
                        } else if let spec {
                            Text("\(tech) \u{00B7} B\(band) (\(spec.commonName), \(spec.duplexMode.rawValue))")
                        } else if let freq {
                            Text("\(tech) \u{00B7} Band \(band) (\(freq))")
                        } else {
                            Text("\(tech) \u{00B7} Band \(band)")
                        }
                    }
                } icon: {
                    Image(systemName: icon)
                }
                .font(.subheadline)
                if isSCC {
                    Text("SCC")
                        .font(.caption2.bold())
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(.secondary.opacity(0.15), in: Capsule())
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }
            HStack {
                Text("RSRP")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                animatedDB(rsrp, font: .body.weight(.bold), color: Color.rsrpColor(rsrp))
                Spacer()
                Text("SINR")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                animatedDB(sinr, font: .body, color: Color.sinrColor(sinr))
            }
            if let bwText = bandwidthText(bandwidth: bandwidth, spec: spec) {
                Text(bwText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if !pci.isEmpty {
                Text("PCI \(pci)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .transition(.opacity.combined(with: .move(edge: .top)))
    }

    private func bandwidthText(bandwidth: String, spec: BandSpec?) -> String? {
        let bwNum = Int(bandwidth.trimmingCharacters(in: .letters.union(.whitespaces)))
        if let bwNum, let spec {
            return "BW \(bwNum) MHz \u{00B7} Max \(spec.maxBandwidthMHz) MHz"
        } else if let bwNum {
            return "BW \(bwNum) MHz"
        }
        return nil
    }

    @ViewBuilder
    private func animatedDB(_ value: Double?, font: Font, color: Color) -> some View {
        if let v = value {
            AnimatedNumber(value: Int(v), font: font, textColor: color, suffix: " dB")
        } else {
            Text("--").font(font.monospacedDigit()).foregroundStyle(.secondary)
        }
    }
}
