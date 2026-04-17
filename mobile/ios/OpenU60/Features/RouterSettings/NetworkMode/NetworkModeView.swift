import SwiftUI

struct NetworkModeView: View {
    @Bindable var viewModel: NetworkModeViewModel

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

            Section("Current") {
                LabeledContent("Network Mode", value: displayLabel(for: viewModel.config.netSelect, in: NetworkModeConfig.netSelectOptions))
            }

            Section("Network Mode") {
                Picker("Mode", selection: $viewModel.selectedNetSelect) {
                    ForEach(NetworkModeConfig.netSelectOptions, id: \.value) { option in
                        Text(option.label).tag(option.value)
                    }
                }
                .pickerStyle(.menu)
            }

            Section {
                Button {
                    Task { await viewModel.applyMode() }
                } label: {
                    Text("Apply")
                        .frame(maxWidth: .infinity)
                }
                .disabled(viewModel.isLoading || viewModel.selectedNetSelect == viewModel.config.netSelect)
            }
        }
        .navigationTitle("Network Mode")
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

    private func displayLabel(for value: String, in options: [(label: String, value: String)]) -> String {
        options.first(where: { $0.value == value })?.label ?? (value.isEmpty ? "—" : value)
    }
}
