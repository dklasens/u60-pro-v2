import SwiftUI

struct USBModeView: View {
    @Bindable var viewModel: USBConnectionViewModel

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

            Section("USB Status") {
                LabeledContent("Cable") {
                    Text(viewModel.usbStatus.cableAttached ? "Connected" : "Disconnected")
                        .foregroundStyle(viewModel.usbStatus.cableAttached ? .green : .secondary)
                }
                LabeledContent("USB-C CC") {
                    Text(viewModel.usbStatus.typecCC)
                }
                LabeledContent("Mode") {
                    Text(viewModel.usbStatus.mode.isEmpty ? "—" : viewModel.usbStatus.mode)
                }
            }

            Section {
                Toggle("Fast Charging (Powerbank)", isOn: Binding(
                    get: { viewModel.usbStatus.powerbankActive },
                    set: { newValue in
                        Task {
                            if newValue {
                                await viewModel.enablePowerbank()
                            } else {
                                await viewModel.disablePowerbank()
                            }
                        }
                    }
                ))
                .disabled(viewModel.isLoading || !viewModel.usbStatus.cableAttached)
            } footer: {
                Text("When enabled, the U60 Pro battery will charge your connected device. This will drain the router's battery faster.")
            }
        }
        .task { await viewModel.refresh() }
        .navigationTitle("USB Mode")
        .overlay {
            if viewModel.isLoading {
                ProgressView()
                    .padding()
                    .background(Color(.systemBackground).opacity(0.85), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}
