import SwiftUI

struct ClientsView: View {
    var viewModel: ClientsViewModel

    var body: some View {
        List {
            if let error = viewModel.error {
                Section {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.caption)
                }
            }

            Section("\(viewModel.devices.count) Devices") {
                ForEach(viewModel.devices) { device in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(device.displayName)
                            .font(.body.weight(.medium))
                        HStack(spacing: 12) {
                            Label(device.ipAddress.isEmpty ? "--" : device.ipAddress, systemImage: "network")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(device.macAddress)
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .navigationTitle("Connected Devices")
        .refreshable { await viewModel.refresh() }
        .overlay {
            if viewModel.isLoading && viewModel.devices.isEmpty {
                ProgressView()
            }
        }
        .task { await viewModel.refresh() }
    }
}
