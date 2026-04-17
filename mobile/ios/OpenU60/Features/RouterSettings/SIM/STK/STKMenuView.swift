import SwiftUI

struct STKMenuView: View {
    @Bindable var viewModel: STKViewModel

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

            ussdSection

            if viewModel.showUssdResponse {
                ussdResponseSection
            }

            stkSection
        }
        .navigationTitle("SIM Services")
        .overlay {
            if viewModel.isLoading {
                ProgressView()
                    .padding()
                    .background(Color(.systemBackground).opacity(0.85), in: RoundedRectangle(cornerRadius: 8))
            }
        }
        .task { await viewModel.loadSTKMenu() }
    }

    // MARK: - USSD

    private var ussdSection: some View {
        Section {
            HStack {
                TextField("USSD code (e.g. *100#)", text: $viewModel.ussdCode)
                    .keyboardType(.phonePad)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)

                Button {
                    Task { await viewModel.sendUSSD() }
                } label: {
                    Image(systemName: "paperplane.fill")
                }
                .disabled(viewModel.ussdCode.isEmpty || viewModel.isLoading)
            }
        } header: {
            Text("USSD")
        } footer: {
            Text("Send carrier service codes to check balance, data plans, etc.")
        }
    }

    private var ussdResponseSection: some View {
        Section("Response") {
            Text(viewModel.ussdResponse.response.isEmpty
                 ? viewModel.ussdResponse.rawResponse
                 : viewModel.ussdResponse.response)
                .font(.body)
                .textSelection(.enabled)

            if viewModel.ussdResponse.sessionActive {
                HStack {
                    TextField("Reply", text: $viewModel.ussdReply)
                        .keyboardType(.phonePad)

                    Button {
                        Task { await viewModel.respondUSSD() }
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                    }
                    .disabled(viewModel.ussdReply.isEmpty || viewModel.isLoading)
                }

                Button(role: .destructive) {
                    Task { await viewModel.cancelUSSD() }
                } label: {
                    Label("End Session", systemImage: "xmark.circle")
                }
            }
        }
    }

    // MARK: - STK

    private var stkSection: some View {
        Group {
            if viewModel.stkNotSupported {
                Section("SIM Toolkit") {
                    Label("Not available on this SIM", systemImage: "simcard")
                        .foregroundStyle(.secondary)
                }
            } else if viewModel.hasSTKMenu {
                Section {
                    ForEach(viewModel.stkMenu.items) { item in
                        Button {
                            Task { await viewModel.selectSTKItem(item) }
                        } label: {
                            Label(item.label, systemImage: "list.bullet")
                                .foregroundStyle(.primary)
                        }
                        .disabled(viewModel.isLoading)
                    }

                    if !viewModel.menuStack.isEmpty {
                        Button {
                            viewModel.goBackSTK()
                        } label: {
                            Label("Back", systemImage: "chevron.left")
                        }
                    }
                } header: {
                    Text(viewModel.stkMenu.title.isEmpty ? "SIM Toolkit" : viewModel.stkMenu.title)
                } footer: {
                    Text("Carrier-provided services from your SIM card")
                }
            } else if viewModel.message == nil && !viewModel.isLoading {
                Section("SIM Toolkit") {
                    Button {
                        Task { await viewModel.loadSTKMenu() }
                    } label: {
                        Label("Retry Loading Menu", systemImage: "arrow.clockwise")
                    }
                }
            }
        }
    }
}
