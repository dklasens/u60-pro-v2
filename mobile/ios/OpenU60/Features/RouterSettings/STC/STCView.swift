import SwiftUI

struct STCView: View {
    @Bindable var viewModel: STCViewModel

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

            Section("Status") {
                LabeledContent("STC") {
                    Text(viewModel.config.enabled ? "Enabled" : "Disabled")
                        .foregroundStyle(viewModel.config.enabled ? .green : .secondary)
                }
            }

            Section("Parameters") {
                TextField("LTE Collect Timer", text: $viewModel.editLteTimer)
                    .keyboardType(.numberPad)
                TextField("NRSA Collect Timer", text: $viewModel.editNrsaTimer)
                    .keyboardType(.numberPad)
                TextField("LTE Whitelist Max", text: $viewModel.editLteMax)
                    .keyboardType(.numberPad)
                TextField("NRSA Whitelist Max", text: $viewModel.editNrsaMax)
                    .keyboardType(.numberPad)

                Button {
                    Task { await viewModel.applyParams() }
                } label: {
                    Text("Apply Parameters")
                        .frame(maxWidth: .infinity)
                }
                .disabled(viewModel.isLoading)
            }

            Section("Controls") {
                Button("Enable STC") {
                    Task { await viewModel.enable() }
                }
                .disabled(viewModel.isLoading || viewModel.config.enabled)

                Button("Disable STC") {
                    Task { await viewModel.disable() }
                }
                .disabled(viewModel.isLoading || !viewModel.config.enabled)

                Button("Reset Whitelist", role: .destructive) {
                    Task { await viewModel.reset() }
                }
                .disabled(viewModel.isLoading)
            }
        }
        .navigationTitle("Smart Tower Connect")
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
