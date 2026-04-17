import SwiftUI

struct SignalDetectView: View {
    var viewModel: SignalDetectViewModel

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

            Section("Controls") {
                if viewModel.status.running {
                    HStack {
                        Text("Progress")
                        Spacer()
                        Text("\(viewModel.status.progress)%")
                            .foregroundStyle(.secondary)
                    }
                    ProgressView(value: Double(viewModel.status.progress), total: 100)

                    Button("Stop Detection", role: .destructive) {
                        Task { await viewModel.stopDetection() }
                    }
                } else {
                    Button("Start Signal Detection") {
                        Task { await viewModel.startDetection() }
                    }
                    .disabled(viewModel.isLoading)
                }
            }

            if !viewModel.status.results.isEmpty {

                Section("Results") {
                    ForEach(viewModel.status.results) { result in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(result.type)
                                    .font(.headline)
                                Text("Band \(result.band)")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            HStack(spacing: 12) {
                                Label(result.rsrp, systemImage: "antenna.radiowaves.left.and.right")
                                Label(result.sinr, systemImage: "waveform")
                            }
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            Text("PCI: \(result.pci)  EARFCN: \(result.earfcn)")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .navigationTitle("Signal Detection")
        .overlay {
            if viewModel.isLoading {
                ProgressView()
                    .padding()
                    .background(Color(.systemBackground).opacity(0.85), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}
