import SwiftUI

struct LANSettingsView: View {
    @Bindable var viewModel: LANSettingsViewModel

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

            Section("LAN") {
                TextField("IP Address", text: $viewModel.editLanIP)
                    .keyboardType(.decimalPad)
                    .autocorrectionDisabled()
                TextField("Subnet Mask", text: $viewModel.editNetmask)
                    .keyboardType(.decimalPad)
                    .autocorrectionDisabled()
            }

            Section("DHCP Server") {
                Toggle("Enable DHCP", isOn: $viewModel.editDhcpEnabled)

                if viewModel.editDhcpEnabled {
                    TextField("Start Address", text: $viewModel.editDhcpStart)
                        .keyboardType(.decimalPad)
                        .autocorrectionDisabled()
                    TextField("End Address", text: $viewModel.editDhcpEnd)
                        .keyboardType(.decimalPad)
                        .autocorrectionDisabled()
                    TextField("Lease Time (seconds)", text: $viewModel.editLeaseTime)
                        .keyboardType(.numberPad)
                }
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
        .navigationTitle("LAN / DHCP")
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
