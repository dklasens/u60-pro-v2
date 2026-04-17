import SwiftUI

struct QoSView: View {
    var viewModel: QoSViewModel

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

            Section("Quality of Service") {
                Toggle("Enable QoS", isOn: Binding(
                    get: { viewModel.config.enabled },
                    set: { enabled in Task { await viewModel.toggle(enabled: enabled) } }
                ))
                .disabled(viewModel.isLoading)
            }
        }
        .navigationTitle("QoS")
        .refreshable { await viewModel.refresh() }
        .overlay {
            if viewModel.isLoading {
                ProgressView()
                    .padding()
                    .background(Color(.systemBackground).opacity(0.85), in: RoundedRectangle(cornerRadius: 8))
            }
        }
        .task { await viewModel.refresh() }
    }
}
