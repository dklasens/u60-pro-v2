import SwiftUI

struct CellLockView: View {
    @Bindable var viewModel: CellLockViewModel

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

            Section("Current Cell") {
                LabeledContent("NR PCI", value: viewModel.status.nrPCI.isEmpty ? "—" : viewModel.status.nrPCI)
                LabeledContent("NR EARFCN", value: viewModel.status.nrEARFCN.isEmpty ? "—" : viewModel.status.nrEARFCN)
                LabeledContent("NR Band", value: viewModel.status.nrBand.isEmpty ? "—" : viewModel.status.nrBand)
                LabeledContent("LTE PCI", value: viewModel.status.ltePCI.isEmpty ? "—" : viewModel.status.ltePCI)
                LabeledContent("LTE EARFCN", value: viewModel.status.lteEARFCN.isEmpty ? "—" : viewModel.status.lteEARFCN)
                LabeledContent("Locked") {
                    Text(viewModel.status.locked ? "Yes" : "No")
                        .foregroundStyle(viewModel.status.locked ? .orange : .green)
                }
            }

            Section("Lock NR Cell") {
                TextField("PCI", text: $viewModel.nrPCI)
                    .keyboardType(.numberPad)
                TextField("EARFCN", text: $viewModel.nrEARFCN)
                    .keyboardType(.numberPad)
                TextField("Band (optional)", text: $viewModel.nrBand)
                    .keyboardType(.numberPad)
                Button("Lock NR") {
                    Task { await viewModel.lockNR() }
                }
                .disabled(viewModel.isLoading || viewModel.nrPCI.isEmpty || viewModel.nrEARFCN.isEmpty)
            }

            Section("Lock LTE Cell") {
                TextField("PCI", text: $viewModel.ltePCI)
                    .keyboardType(.numberPad)
                TextField("EARFCN", text: $viewModel.lteEARFCN)
                    .keyboardType(.numberPad)
                Button("Lock LTE") {
                    Task { await viewModel.lockLTE() }
                }
                .disabled(viewModel.isLoading || viewModel.ltePCI.isEmpty || viewModel.lteEARFCN.isEmpty)
            }

            Section("Neighbor Scan") {
                Button {
                    Task { await viewModel.scanNeighbors() }
                } label: {
                    HStack {
                        Text("Scan Neighbors")
                        if viewModel.isScanning {
                            Spacer()
                            ProgressView()
                        }
                    }
                }
                .disabled(viewModel.isScanning)

                ForEach(viewModel.neighbors) { cell in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(cell.type)
                                .font(.headline)
                            Text("Band \(cell.band)")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        Text("PCI: \(cell.pci)  EARFCN: \(cell.earfcn)  RSRP: \(cell.rsrp)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 2)
                }
            }

            if viewModel.status.locked {
                Section {
                    Button("Unlock Cell", role: .destructive) {
                        Task { await viewModel.unlock() }
                    }
                    .disabled(viewModel.isLoading)
                }
            }
        }
        .navigationTitle("Cell Lock")
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
