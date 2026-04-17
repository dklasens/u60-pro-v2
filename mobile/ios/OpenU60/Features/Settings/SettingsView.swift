import SwiftUI

struct SettingsView: View {
    @State private var viewModel: SettingsViewModel

    init(client: AgentClient) {
        _viewModel = State(initialValue: SettingsViewModel(client: client))
    }

    var body: some View {
        @Bindable var vm = viewModel
        NavigationStack {
            Form {
                Section("Gateway") {
                    HStack {
                        TextField("Gateway IP", text: $vm.gatewayIP)
                            .keyboardType(.decimalPad)
                            .autocorrectionDisabled()
                        Button("Detect") {
                            Task { await viewModel.autoDetectGateway() }
                        }
                        .buttonStyle(.bordered)
                        .font(.caption)
                        .disabled(viewModel.isDetectingGateway)
                        if viewModel.isDetectingGateway {
                            ProgressView()
                        }
                    }
                }

                Section("Authentication") {
                    if viewModel.hasStoredPassword {
                        HStack {
                            Text("Password stored in Keychain")
                                .foregroundStyle(.secondary)
                            Spacer()
                            Button("Clear", role: .destructive) {
                                viewModel.clearPassword()
                            }
                            .font(.caption)
                        }
                    }
                    SecureField("New Password", text: $vm.passwordInput)
                    Button("Save to Keychain") {
                        viewModel.savePassword()
                    }
                    .disabled(viewModel.passwordInput.isEmpty)
                }

                Section("Polling") {
                    VStack(alignment: .leading) {
                        Text("Refresh interval: \(viewModel.pollInterval, specifier: "%.1f")s")
                        Slider(value: $vm.pollInterval, in: 1...10, step: 0.5)
                    }
                }

                Section("Appearance") {
                    Picker("Theme", selection: $vm.darkModeOverride) {
                        Text("System").tag(0)
                        Text("Light").tag(1)
                        Text("Dark").tag(2)
                    }
                    .pickerStyle(.segmented)
                }

                Section("About") {
                    LabeledContent("App", value: "OpenU60")
                    LabeledContent("Device", value: "ZTE U60 Pro (MU5250)")
                    LabeledContent("API", value: "zte-agent REST")
                }

                Section("Legal") {
                    Text("This app is not affiliated with, endorsed by, or sponsored by ZTE Corporation. ZTE and U60 Pro are trademarks of ZTE Corporation.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Link("Privacy Policy", destination: URL(string: "https://open-u60-pro.vercel.app/privacy")!)
                }
            }
            .navigationTitle("Settings")
            .overlay {
                if viewModel.showSavedConfirmation {
                    savedToast
                }
            }
        }
    }

    private var savedToast: some View {
        Text("Password saved")
            .font(.subheadline.weight(.medium))
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color(.systemBackground).opacity(0.85), in: RoundedRectangle(cornerRadius: 10))
            .transition(.move(edge: .top).combined(with: .opacity))
            .task {
                try? await Task.sleep(for: .seconds(1.5))
                withAnimation { viewModel.showSavedConfirmation = false }
            }
    }
}
