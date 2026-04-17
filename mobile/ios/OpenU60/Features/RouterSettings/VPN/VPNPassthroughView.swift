import SwiftUI

struct VPNPassthroughView: View {
    @Bindable var viewModel: VPNPassthroughViewModel

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

            Section("VPN Passthrough") {
                Toggle("L2TP", isOn: $viewModel.editL2tp)
                Toggle("PPTP", isOn: $viewModel.editPptp)
                Toggle("IPSec", isOn: $viewModel.editIpsec)
            }

            Section {
                Button {
                    Task { await viewModel.apply() }
                } label: {
                    Text("Apply")
                        .frame(maxWidth: .infinity)
                }
                .disabled(viewModel.isLoading)
            }
        }
        .navigationTitle("VPN Passthrough")
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
