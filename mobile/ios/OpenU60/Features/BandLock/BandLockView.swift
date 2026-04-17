import SwiftUI

struct BandLockView: View {
    var viewModel: BandLockViewModel

    var body: some View {
        List {
            if let msg = viewModel.message {
                Section {
                    Text(msg)
                        .font(.subheadline)
                        .foregroundStyle(viewModel.messageIsError ? .red : .green)
                        .textSelection(.enabled)
                }
            }

            Section {
                Button(role: .destructive) {
                    Task { await viewModel.unlockAll() }
                } label: {
                    Label("Unlock All Bands", systemImage: "lock.open")
                }
                .disabled(viewModel.isLoading)
            }

            Section("5G NR Bands") {
                bandGrid(bands: BandConfig.commonNRBands, selected: viewModel.config.nrBands, technology: .nr) {
                    viewModel.toggleNRBand($0)
                }

                Button {
                    Task { await viewModel.applyNRLock() }
                } label: {
                    Label("Apply NR Lock", systemImage: "lock.fill")
                }
                .disabled(viewModel.config.nrBands.isEmpty || viewModel.isLoading)
            }

            Section("LTE Bands") {
                bandGrid(bands: BandConfig.commonLTEBands, selected: viewModel.config.lteBands, technology: .lte) {
                    viewModel.toggleLTEBand($0)
                }

                Button {
                    Task { await viewModel.applyLTELock() }
                } label: {
                    Label("Apply LTE Lock", systemImage: "lock.fill")
                }
                .disabled(viewModel.config.lteBands.isEmpty || viewModel.isLoading)
            }
        }
        .navigationTitle("Band Lock")
        .overlay {
            if viewModel.isLoading {
                ProgressView()
                    .padding()
                    .background(Color(.systemBackground).opacity(0.85), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    private func bandGrid(bands: [String], selected: Set<String>, technology: BandTechnology, toggle: @escaping (String) -> Void) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 5), spacing: 8) {
            ForEach(bands, id: \.self) { band in
                BandButton(
                    band: band,
                    isSelected: selected.contains(band),
                    spec: technology.spec(for: band),
                    toggle: { toggle(band) }
                )
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Band Button

private struct BandButton: View {
    let band: String
    let isSelected: Bool
    let spec: BandSpec?
    let toggle: () -> Void

    @State private var showDetail = false

    var body: some View {
        Button {
            toggle()
        } label: {
            VStack(spacing: 1) {
                Text("B\(band)")
                    .font(.caption.monospacedDigit())
                if let spec {
                    Text(spec.commonName)
                        .font(.system(size: 7))
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(isSelected ? Color.accentColor : Color.gray.opacity(0.2),
                        in: RoundedRectangle(cornerRadius: 6))
            .foregroundStyle(isSelected ? .white : .primary)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            LongPressGesture(minimumDuration: 0.5)
                .onEnded { _ in
                    if spec != nil { showDetail = true }
                }
        )
        .popover(isPresented: $showDetail) {
            if let spec {
                BandDetailPopover(spec: spec)
            }
        }
    }
}

// MARK: - Band Detail Popover

private struct BandDetailPopover: View {
    let spec: BandSpec

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Band \(spec.band) — \(spec.commonName)")
                .font(.headline)

            LabeledContent("Duplex", value: spec.duplexMode.rawValue)
            LabeledContent("Max BW", value: "\(spec.maxBandwidthMHz) MHz")
            LabeledContent("DL", value: "\(spec.dlRange) MHz")
            if !spec.ulRange.isEmpty {
                LabeledContent("UL", value: "\(spec.ulRange) MHz")
            }
            if spec.frequencyRange == .fr2 {
                LabeledContent("Range", value: spec.frequencyRange.rawValue)
            }
        }
        .font(.subheadline)
        .padding()
        .presentationCompactAdaptation(.popover)
    }
}
