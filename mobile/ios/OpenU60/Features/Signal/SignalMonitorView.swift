import SwiftUI
import Charts

struct SignalMonitorView: View {
    var viewModel: SignalMonitorViewModel

    private var showNR: Bool {
        viewModel.operatorInfo.showNR(nr: viewModel.nrSignal)
    }

    private var showLTE: Bool {
        viewModel.operatorInfo.showLTE(lte: viewModel.lteSignal)
    }

    private var show3G: Bool {
        viewModel.operatorInfo.show3G(nr: viewModel.nrSignal, lte: viewModel.lteSignal, wcdma: viewModel.wcdmaSignal)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                rsrpChart
                if showNR { nrPanel }
                if showLTE { ltePanel }
                if show3G { wcdmaPanel }
            }
            .padding()
        }
        .navigationTitle("Signal Monitor")
        .refreshable { await viewModel.refresh() }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                LastUpdatedView(date: viewModel.lastUpdated)
            }
        }
        .task {
            viewModel.startPolling()
            defer { viewModel.stopPolling() }
            try? await Task.sleep(for: .seconds(86400 * 365))
        }
    }

    // MARK: - RSRP History Chart

    private var rsrpChart: some View {
        CardView {
            VStack(alignment: .leading, spacing: 8) {
                Text("RSRP History")
                    .font(.headline)

                if viewModel.history.isEmpty {
                    Text("Collecting data...")
                        .foregroundStyle(.secondary)
                        .frame(height: 150)
                        .frame(maxWidth: .infinity)
                } else {
                    Chart {
                        ForEach(viewModel.history) { point in
                            if let nrRSRP = point.nrRSRP {
                                LineMark(
                                    x: .value("Time", point.timestamp),
                                    y: .value("dBm", nrRSRP)
                                )
                                .foregroundStyle(by: .value("Type", "NR"))
                                .interpolationMethod(.catmullRom)
                            }
                            if showLTE, let lteRSRP = point.lteRSRP {
                                LineMark(
                                    x: .value("Time", point.timestamp),
                                    y: .value("dBm", lteRSRP)
                                )
                                .foregroundStyle(by: .value("Type", "LTE"))
                                .interpolationMethod(.catmullRom)
                            }
                        }
                    }
                    .chartForegroundStyleScale([
                        "NR": Color.blue,
                        "LTE": Color.orange,
                    ])
                    .chartYScale(domain: -140...(-40))
                    .chartYAxis {
                        AxisMarks(values: [-140, -120, -100, -80, -60, -40]) { value in
                            AxisGridLine()
                            AxisValueLabel {
                                if let v = value.as(Int.self) {
                                    Text("\(v)")
                                }
                            }
                        }
                    }
                    .chartXAxis {
                        AxisMarks(values: .automatic(desiredCount: 4)) { _ in
                            AxisGridLine()
                            AxisValueLabel(format: .dateTime.minute().second())
                        }
                    }
                    .frame(height: 200)
                }
            }
        }
    }

    // MARK: - NR Panel

    private var nrPanel: some View {
        let nr = viewModel.nrSignal
        let nrSccCount = nr.sccCarriers.count
        let nrCaActive = nrSccCount > 0
        let nrNumCC = 1 + nrSccCount

        return CardView {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Label("5G NR", systemImage: "antenna.radiowaves.left.and.right")
                        .font(.headline)
                    if nrCaActive {
                        Text("\(nrNumCC) CC")
                            .font(.caption2.bold())
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.blue.opacity(0.15), in: Capsule())
                            .foregroundStyle(.blue)
                    }
                    Spacer()
                    if nr.isConnected {
                        Text(Color.rsrpQuality(nr.rsrp))
                            .font(.caption.bold())
                            .foregroundStyle(Color.rsrpColor(nr.rsrp))
                    } else {
                        Text("Disconnected")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                if nr.isConnected {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                        SignalMetricView(label: "RSRP", value: nr.rsrp, unit: "dBm", color: Color.rsrpColor(nr.rsrp))
                        SignalMetricView(label: "RSRQ", value: nr.rsrq, unit: "dB", color: Color.rsrqColor(nr.rsrq))
                        SignalMetricView(label: "SINR", value: nr.sinr, unit: "dB", color: Color.sinrColor(nr.sinr))
                        SignalMetricView(label: "RSSI", value: nr.rssi, unit: "dBm", color: .primary)
                    }

                    Divider()

                    VStack(alignment: .leading, spacing: 4) {
                        bandMetaRow(band: nr.band, technology: .nr)
                        metaRow("PCI", nr.pci)
                        metaRow("Cell ID", nr.cellID)
                        metaRow("Channel", nr.channel)
                        bandwidthMetaRow(bandwidth: nr.bandwidth, band: nr.band, technology: .nr)
                        metaRow("CA", nrCaActive ? "Active (\(nrNumCC) CC)" : "Inactive")
                        if nrCaActive {
                            let totalBW = nrTotalBandwidth(pccBW: nr.bandwidth, sccs: nr.sccCarriers)
                            if let total = totalBW {
                                metaRow("Total BW", "\(total) MHz")
                            }
                        }
                    }

                    if !nr.sccCarriers.isEmpty {
                        Divider()
                        ForEach(nr.sccCarriers) { carrier in
                            sccCarrierView(carrier)
                        }
                    }
                }
            }
        }
    }

    private func nrTotalBandwidth(pccBW: String, sccs: [LTECarrier]) -> Int? {
        let pcc = Int(pccBW.trimmingCharacters(in: .letters.union(.whitespaces)))
        let sccBWs = sccs.compactMap { Int($0.bandwidth.trimmingCharacters(in: .letters.union(.whitespaces))) }
        guard let pccVal = pcc else {
            return sccBWs.isEmpty ? nil : sccBWs.reduce(0, +)
        }
        return pccVal + sccBWs.reduce(0, +)
    }

    // MARK: - LTE Panel

    private var ltePanel: some View {
        let lte = viewModel.lteSignal
        let sccCount = lte.sccCarriers.count
        let caActive = lte.caState != "0" && sccCount > 0
        let numCC = 1 + sccCount

        return CardView {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Label("LTE", systemImage: "cellularbars")
                        .font(.headline)
                    if caActive {
                        Text("\(numCC) CC")
                            .font(.caption2.bold())
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.orange.opacity(0.15), in: Capsule())
                            .foregroundStyle(.orange)
                    }
                    Spacer()
                    if lte.isConnected {
                        Text(Color.rsrpQuality(lte.rsrp))
                            .font(.caption.bold())
                            .foregroundStyle(Color.rsrpColor(lte.rsrp))
                    } else {
                        Text("Disconnected")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                if lte.isConnected {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                        SignalMetricView(label: "RSRP", value: lte.rsrp, unit: "dBm", color: Color.rsrpColor(lte.rsrp))
                        SignalMetricView(label: "RSRQ", value: lte.rsrq, unit: "dB", color: Color.rsrqColor(lte.rsrq))
                        SignalMetricView(label: "SINR", value: lte.sinr, unit: "dB", color: Color.sinrColor(lte.sinr))
                        SignalMetricView(label: "RSSI", value: lte.rssi, unit: "dBm", color: .primary)
                    }

                    Divider()

                    VStack(alignment: .leading, spacing: 4) {
                        bandMetaRow(band: lte.band, technology: .lte)
                        metaRow("PCI", lte.pci)
                        metaRow("Cell ID", lte.cellID)
                        metaRow("EARFCN", lte.earfcn)
                        bandwidthMetaRow(bandwidth: lte.bandwidth, band: lte.band, technology: .lte)
                        metaRow("CA", caActive ? "Active (\(numCC) CC)" : "Inactive")
                    }

                    if !lte.sccCarriers.isEmpty {
                        Divider()
                        ForEach(lte.sccCarriers) { carrier in
                            sccCarrierView(carrier)
                        }
                    }
                }
            }
        }
    }

    private func sccCarrierView(_ carrier: LTECarrier) -> some View {
        let tech: BandTechnology = carrier.label.hasPrefix("5G") ? .nr : .lte
        let spec = tech.spec(for: carrier.band)

        return VStack(alignment: .leading, spacing: 4) {
            Text(carrier.label)
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            HStack(spacing: 12) {
                if let spec {
                    Text("B\(carrier.band) (\(spec.commonName))")
                        .font(.caption2.monospacedDigit())
                } else {
                    Text("B\(carrier.band)")
                        .font(.caption2.monospacedDigit())
                }
                Text("PCI \(carrier.pci)")
                    .font(.caption2.monospacedDigit())
                Text("BW \(carrier.bandwidth)")
                    .font(.caption2.monospacedDigit())
            }
            .foregroundStyle(.secondary)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 4) {
                SignalMetricView(label: "RSRP", value: carrier.rsrp, unit: "dBm", color: Color.rsrpColor(carrier.rsrp))
                SignalMetricView(label: "RSRQ", value: carrier.rsrq, unit: "dB", color: Color.rsrqColor(carrier.rsrq))
                SignalMetricView(label: "SINR", value: carrier.sinr, unit: "dB", color: Color.sinrColor(carrier.sinr))
                SignalMetricView(label: "RSSI", value: carrier.rssi, unit: "dBm", color: .primary)
            }
        }
    }

    // MARK: - WCDMA Panel

    private var wcdmaPanel: some View {
        CardView {
            VStack(alignment: .leading, spacing: 8) {
                Label("WCDMA", systemImage: "antenna.radiowaves.left.and.right.circle")
                    .font(.headline)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    SignalMetricView(label: "RSCP", value: viewModel.wcdmaSignal.rscp, unit: "dBm", color: .primary)
                    SignalMetricView(label: "Ec/Io", value: viewModel.wcdmaSignal.ecio, unit: "dB", color: .primary)
                }
            }
        }
    }

    // MARK: - Helpers

    private func bandMetaRow(band: String, technology: BandTechnology) -> some View {
        let spec = technology.spec(for: band)
        let display: String
        if band.isEmpty {
            display = "--"
        } else if let spec {
            display = "B\(band) (\(spec.commonName), \(spec.duplexMode.rawValue))"
        } else {
            display = "B\(band)"
        }
        return metaRow("Band", display)
    }

    private func bandwidthMetaRow(bandwidth: String, band: String, technology: BandTechnology) -> some View {
        let spec = technology.spec(for: band)
        let bwNum = Int(bandwidth.trimmingCharacters(in: .letters.union(.whitespaces)))
        let display: String
        if let bwNum, let spec {
            display = "\(bwNum) / \(spec.maxBandwidthMHz) MHz max"
        } else if bandwidth.isEmpty {
            display = "--"
        } else {
            display = bandwidth
        }
        return metaRow("Bandwidth", display)
    }

    private func metaRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 80, alignment: .leading)
            Text(value.isEmpty ? "--" : value)
                .font(.caption.monospacedDigit())
        }
    }
}

struct SignalMetricView: View {
    let label: String
    let value: Double?
    let unit: String
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value.map { "\(Int($0))" } ?? "--")
                .font(.title3.monospacedDigit().bold())
                .foregroundStyle(color)
            Text(unit)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
    }
}
