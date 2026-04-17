import SwiftUI

struct MobileNetworkView: View {
    @Bindable var viewModel: MobileNetworkViewModel

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
                Toggle("Airplane Mode", isOn: Binding(
                    get: { viewModel.airplaneModeEnabled },
                    set: { val in
                        viewModel.airplaneModeEnabled = val
                        Task { await viewModel.setAirplaneMode(enabled: val) }
                    }
                ))
                .disabled(viewModel.isLoading)

                Toggle("Mobile Data", isOn: Binding(
                    get: { viewModel.selectedDataEnabled },
                    set: { val in
                        viewModel.selectedDataEnabled = val
                        Task { await viewModel.setMobileData(enabled: val) }
                    }
                ))
                .disabled(viewModel.isLoading || viewModel.airplaneModeEnabled)
            } header: {
                Text("Connectivity")
            } footer: {
                Text(mobileDataFooter)
            }

            Section("Connection Mode") {
                Picker("Mode", selection: $viewModel.selectedConnectMode) {
                    Text("Automatic").tag(1)
                    Text("Manual").tag(0)
                }
                .pickerStyle(.segmented)
                .disabled(viewModel.isLoading || viewModel.airplaneModeEnabled)
            }

            Section {
                Toggle("Data Roaming", isOn: $viewModel.selectedRoaming)
                    .disabled(viewModel.isLoading || viewModel.airplaneModeEnabled)
            } footer: {
                Text("Enabling roaming may incur additional charges from your carrier.")
            }

            Section("Network Selection") {
                Picker("Mode", selection: $viewModel.selectedNetSelectMode) {
                    Text("Automatic").tag("auto_select")
                    Text("Manual").tag("manual_select")
                }
                .pickerStyle(.segmented)
                .disabled(viewModel.isLoading || viewModel.airplaneModeEnabled)

                if viewModel.selectedNetSelectMode == "manual_select" {
                    Button {
                        Task { await viewModel.scanNetworks() }
                    } label: {
                        HStack {
                            Text("Scan Networks")
                            Spacer()
                            if viewModel.isScanning {
                                ProgressView()
                            }
                        }
                    }
                    .disabled(viewModel.isScanning)

                    ForEach(viewModel.config.operators) { op in
                        Button {
                            Task { await viewModel.registerNetwork(mccMnc: op.mccMnc, rat: op.rat) }
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(op.name)
                                        .foregroundStyle(.primary)
                                    Text("\(op.mccMnc) · \(op.rat)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if op.status == "current" {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.green)
                                } else if op.status == "forbidden" {
                                    Image(systemName: "xmark.circle")
                                        .foregroundStyle(.red)
                                }
                            }
                        }
                        .disabled(viewModel.isLoading || op.status == "forbidden")
                    }
                }
            }

            Section {
                Button {
                    Task { await viewModel.applySettings() }
                } label: {
                    Text("Apply")
                        .frame(maxWidth: .infinity)
                }
                .disabled(viewModel.isLoading || !viewModel.hasChanges || viewModel.airplaneModeEnabled)
            }
        }
        .navigationTitle("Mobile Network")
        .refreshable { await viewModel.refresh() }
        .overlay {
            if viewModel.isLoading {
                ProgressView()
                    .padding()
                    .background(Color(.systemBackground).opacity(0.85), in: RoundedRectangle(cornerRadius: 8))
            }
        }
        .alert("Reboot Required", isPresented: $viewModel.showRebootAfterAirplaneOff) {
            Button("Reboot Now") {
                Task { await viewModel.reboot() }
            }
            Button("Cancel", role: .cancel) {
                viewModel.airplaneModeEnabled = true
            }
        } message: {
            Text("Due to a firmware limitation, the cellular radio cannot be restored without rebooting. The router will restart (about 60 seconds).")
        }
        .task { await viewModel.refresh() }
    }

    private var mobileDataFooter: String {
        if !viewModel.config.isDataEnabled && viewModel.config.isConnected {
            return "Mobile data setting is off, but the connection is still active."
        } else if !viewModel.config.isDataEnabled {
            return "Mobile data is disabled."
        } else if viewModel.config.isConnected {
            let status = viewModel.config.connectStatus
                .replacingOccurrences(of: "_", with: " ")
                .capitalized
            return "Connected — \(status)"
        } else if !viewModel.config.connectStatus.isEmpty {
            return "Disconnected"
        } else {
            return "Disabling mobile data will disconnect the cellular connection."
        }
    }
}
