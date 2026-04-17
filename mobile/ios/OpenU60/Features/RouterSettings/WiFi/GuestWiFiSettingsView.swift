import SwiftUI

struct GuestWiFiSettingsView: View {
    @Bindable var viewModel: GuestWiFiSettingsViewModel

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
                Toggle("2.4 GHz", isOn: $viewModel.editEnabled2g)
                Toggle("5 GHz", isOn: $viewModel.editEnabled5g)
            } header: {
                Text("Radio Bands")
            } footer: {
                if viewModel.isTimerExpired {
                    Text("Timer expired — guest WiFi was automatically disabled")
                        .foregroundStyle(.orange)
                }
            }

            if viewModel.isAnyBandEnabled {
                Section("Network") {
                    TextField("SSID", text: $viewModel.editSsid)
                        .autocorrectionDisabled()
                    SecureField("Password", text: $viewModel.editKey)

                    Picker("Encryption", selection: $viewModel.editEncryption) {
                        ForEach(WiFiConfig.encryptionOptions, id: \.self) { enc in
                            Text(encryptionLabel(enc)).tag(enc)
                        }
                    }

                    Toggle("Hidden SSID", isOn: $viewModel.editHidden)
                    Toggle("Client Isolation", isOn: $viewModel.editIsolate)
                }
            }

            if viewModel.isAnyBandEnabled || viewModel.isTimerExpired || viewModel.remainingSeconds > 0 {
                Section {
                    Picker("Auto-Shutoff", selection: $viewModel.editActiveTime) {
                        ForEach(GuestWiFiConfig.activeTimeOptions, id: \.minutes) { option in
                            Text(option.label).tag(option.minutes)
                        }
                    }
                } header: {
                    Text("Timer")
                } footer: {
                    VStack(alignment: .leading, spacing: 4) {
                        if viewModel.editActiveTime > 0 {
                            Text("Guest WiFi will automatically turn off after \(activeTimeLabel(viewModel.editActiveTime))")
                        }
                        if let remaining = viewModel.remainingTimeText {
                            Text(remaining)
                                .foregroundStyle(.orange)
                        }
                    }
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
        .navigationTitle("Guest WiFi")
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

    private func encryptionLabel(_ enc: String) -> String {
        switch enc {
        case "none": return "None"
        case "psk+tkip": return "WPA-PSK (TKIP)"
        case "psk+ccmp": return "WPA-PSK (AES)"
        case "psk2+ccmp": return "WPA2-PSK (AES)"
        case "psk-mixed+ccmp": return "WPA/WPA2 Mixed"
        case "sae": return "WPA3-SAE"
        case "sae-mixed": return "WPA2/WPA3 Mixed"
        default: return enc
        }
    }

    private func activeTimeLabel(_ minutes: Int) -> String {
        GuestWiFiConfig.activeTimeOptions.first { $0.minutes == minutes }?.label ?? "\(minutes) min"
    }
}
