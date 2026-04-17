import SwiftUI

struct TelemetryBlockerView: View {
    @Bindable var viewModel: TelemetryBlockerViewModel

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

            Section("Domain Filter") {
                LabeledContent("Status") {
                    Text(viewModel.filterConfig.enabled ? "Enabled" : "Disabled")
                        .foregroundStyle(viewModel.filterConfig.enabled ? .green : .secondary)
                }

                Button(viewModel.filterConfig.enabled ? "Disable Filter" : "Enable Filter") {
                    Task { await viewModel.toggleFilter(enabled: !viewModel.filterConfig.enabled) }
                }
                .disabled(viewModel.isLoading)
            }

            Section("Quick Actions") {
                Button("Block All ZTE Telemetry") {
                    Task { await viewModel.blockAllTelemetry() }
                }
                .disabled(viewModel.isLoading)

                ForEach(TelemetryParser.knownTelemetryDomains, id: \.self) { domain in
                    let isBlocked = viewModel.filterConfig.rules.contains { $0.domain == domain }
                    HStack {
                        Text(domain)
                            .font(.caption)
                        Spacer()
                        Image(systemName: isBlocked ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(isBlocked ? .green : .secondary)
                    }
                }
            }

            Section {
                HStack {
                    TextField("Domain to block", text: $viewModel.newDomain)
                        .keyboardType(.URL)
                        .textContentType(.URL)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    Button("Add") {
                        Task { await viewModel.addDomain(viewModel.newDomain) }
                    }
                    .disabled(viewModel.newDomain.trimmingCharacters(in: .whitespaces).isEmpty || viewModel.isLoading)
                }
            } header: {
                Text("Add Custom Domain")
            }

            if !viewModel.filterConfig.rules.isEmpty {
                Section("Blocked Domains") {
                    ForEach(viewModel.filterConfig.rules) { rule in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(rule.domain)
                                    .font(.body)
                                Text(rule.enabled ? "Active" : "Inactive")
                                    .font(.caption)
                                    .foregroundStyle(rule.enabled ? .green : .secondary)
                            }
                            Spacer()
                            Button(role: .destructive) {
                                Task { await viewModel.removeDomain(rule) }
                            } label: {
                                Image(systemName: "trash")
                            }
                            .disabled(viewModel.isLoading)
                        }
                    }
                }
            }
        }
        .navigationTitle("Telemetry Blocker")
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
