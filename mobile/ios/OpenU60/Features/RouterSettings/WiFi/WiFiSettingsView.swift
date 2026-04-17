import SwiftUI

struct WiFiSettingsView: View {
    @Bindable var viewModel: WiFiSettingsViewModel

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
                Toggle("WiFi", isOn: $viewModel.editWifiOnOff)
            }

            if viewModel.editWifiOnOff {
                Section {
                    Toggle("Radio", isOn: Binding(
                        get: { !viewModel.editRadio2gDisabled },
                        set: { viewModel.editRadio2gDisabled = !$0 }
                    ))

                    if !viewModel.editRadio2gDisabled {
                        TextField("SSID", text: $viewModel.editSSID2g)
                            .autocorrectionDisabled()
                        SecureField("Password", text: $viewModel.editKey2g)

                        Picker("Channel", selection: $viewModel.editChannel2g) {
                            ForEach(WiFiConfig.channelOptions2g, id: \.self) { ch in
                                Text(ch == "auto" ? "Auto" : "Ch \(ch)").tag(ch)
                            }
                        }

                        Picker("Bandwidth", selection: $viewModel.editBandwidth2g) {
                            ForEach(WiFiConfig.bandwidthOptions2g, id: \.self) { bw in
                                Text(bandwidthLabel(bw)).tag(bw)
                            }
                        }

                        Picker("TX Power", selection: $viewModel.editTxpower2g) {
                            ForEach(WiFiConfig.txpowerOptions, id: \.self) { pwr in
                                Text("\(pwr)%").tag(pwr)
                            }
                        }

                        Picker("Encryption", selection: $viewModel.editEncryption2g) {
                            ForEach(WiFiConfig.encryptionOptions, id: \.self) { enc in
                                Text(encryptionLabel(enc)).tag(enc)
                            }
                        }

                        Toggle("Hidden SSID", isOn: $viewModel.editHidden2g)
                    }
                } header: {
                    Text("2.4 GHz")
                } footer: {
                    VStack(alignment: .leading, spacing: 4) {
                        if let pwr = Int(viewModel.editTxpower2g), pwr <= 20 {
                            Text("Low TX power may reduce range and prevent some clients from connecting.")
                        }
                    }
                }

                Section {
                    Toggle("Radio", isOn: Binding(
                        get: { !viewModel.editRadio5gDisabled },
                        set: { viewModel.editRadio5gDisabled = !$0 }
                    ))

                    if !viewModel.editRadio5gDisabled {
                        TextField("SSID", text: $viewModel.editSSID5g)
                            .autocorrectionDisabled()
                        SecureField("Password", text: $viewModel.editKey5g)

                        Picker("Channel", selection: $viewModel.editChannel5g) {
                            ForEach(WiFiConfig.channels5g(for: viewModel.editBandwidth5g), id: \.self) { ch in
                                Text(ch == "auto" ? "Auto" : "Ch \(ch)").tag(ch)
                            }
                        }

                        Picker("Bandwidth", selection: $viewModel.editBandwidth5g) {
                            ForEach(WiFiConfig.bandwidths5g(for: viewModel.editChannel5g), id: \.self) { bw in
                                Text(bandwidthLabel(bw)).tag(bw)
                            }
                        }
                        .onChange(of: viewModel.editBandwidth5g) { _, newBW in
                            let valid = WiFiConfig.channels5g(for: newBW)
                            if !valid.contains(viewModel.editChannel5g) {
                                viewModel.editChannel5g = "auto"
                            }
                        }
                        .onChange(of: viewModel.editChannel5g) { _, newCh in
                            let valid = WiFiConfig.bandwidths5g(for: newCh)
                            if !valid.contains(viewModel.editBandwidth5g) {
                                viewModel.editBandwidth5g = "auto"
                            }
                        }

                        Picker("TX Power", selection: $viewModel.editTxpower5g) {
                            ForEach(WiFiConfig.txpowerOptions, id: \.self) { pwr in
                                Text("\(pwr)%").tag(pwr)
                            }
                        }

                        Picker("Encryption", selection: $viewModel.editEncryption5g) {
                            ForEach(WiFiConfig.encryptionOptions, id: \.self) { enc in
                                Text(encryptionLabel(enc)).tag(enc)
                            }
                        }

                        Toggle("Hidden SSID", isOn: $viewModel.editHidden5g)
                    }
                } header: {
                    Text("5 GHz")
                } footer: {
                    VStack(alignment: .leading, spacing: 4) {
                        if viewModel.editBandwidth5g == "EHT160" {
                            Text("160 MHz: channels 36–64 or 100–128")
                        } else if viewModel.editBandwidth5g == "EHT80" {
                            Text("80 MHz: channels 36–64, 100–128, or 149–161")
                        }
                        if viewModel.editBandwidth5g == "EHT20" {
                            Text("20 MHz on 5 GHz is very narrow — some clients may fail to connect or have poor performance. Use 80 MHz or wider for best compatibility.")
                        }
                        if let pwr = Int(viewModel.editTxpower5g), pwr <= 20 {
                            Text("Low TX power on 5 GHz may prevent clients from connecting, especially with wider bandwidths")
                        }
                    }
                }

                Section("Advanced") {
                    Toggle("WiFi 7 (802.11be)", isOn: $viewModel.editWifi7Enabled)
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
            } footer: {
                Text("Applying changes will briefly disconnect WiFi while settings are restarted")
            }
        }
        .navigationTitle("WiFi Settings")
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

    private func bandwidthLabel(_ bw: String) -> String {
        switch bw {
        case "auto": return "Auto"
        case "EHT20": return "20 MHz"
        case "EHT40": return "40 MHz"
        case "EHT80": return "80 MHz"
        case "EHT160": return "160 MHz"
        default: return bw
        }
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
}
