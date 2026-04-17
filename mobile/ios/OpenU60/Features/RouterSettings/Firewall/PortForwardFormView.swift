import SwiftUI

struct PortForwardFormView: View {
    var viewModel: FirewallSettingsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var protocol_: String = "tcp"
    @State private var wanPort: String = ""
    @State private var lanIP: String = ""
    @State private var lanPort: String = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Rule") {
                    TextField("Name", text: $name)
                    Picker("Protocol", selection: $protocol_) {
                        Text("TCP").tag("tcp")
                        Text("UDP").tag("udp")
                        Text("TCP + UDP").tag("tcp+udp")
                    }
                }

                Section("WAN") {
                    TextField("WAN Port", text: $wanPort)
                        .keyboardType(.numberPad)
                }

                Section("LAN") {
                    TextField("LAN IP", text: $lanIP)
                        .keyboardType(.decimalPad)
                        .autocorrectionDisabled()
                    TextField("LAN Port", text: $lanPort)
                        .keyboardType(.numberPad)
                }

                Section {
                    Button {
                        Task {
                            await viewModel.addPortForward(
                                name: name,
                                protocol_: protocol_,
                                wanPort: wanPort,
                                lanIP: lanIP,
                                lanPort: lanPort
                            )
                        }
                    } label: {
                        Text("Add Rule")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(wanPort.isEmpty || lanIP.isEmpty || lanPort.isEmpty || viewModel.isLoading)
                }
            }
            .navigationTitle("New Port Forward")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
