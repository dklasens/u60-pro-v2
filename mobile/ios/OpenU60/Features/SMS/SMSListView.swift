import SwiftUI

struct SMSListView: View {
    var viewModel: SMSViewModel
    let client: AgentClient
    let authManager: AuthManager
    @State private var showCompose = false
    @State private var showCall = false

    var body: some View {
        NavigationStack {
            List {
                Picker("Storage", selection: Binding(
                    get: { viewModel.storageFilter },
                    set: { newValue in
                        viewModel.storageFilter = newValue
                        Task { await viewModel.refresh() }
                    }
                )) {
                    ForEach(SMSStorageFilter.allCases, id: \.self) { filter in
                        Text(filter.rawValue).tag(filter)
                    }
                }
                .pickerStyle(.segmented)
                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))

                if let error = viewModel.error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }

                if viewModel.capacity.nvTotal > 0 {
                    Section {
                        HStack {
                            Text("Storage")
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text("\(viewModel.capacity.nvUsed)/\(viewModel.capacity.nvTotal)")
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                Section("\(viewModel.conversations.count) Conversations") {
                    ForEach(viewModel.conversations) { conversation in
                        NavigationLink(value: conversation.id) {
                            SMSConversationRow(conversation: conversation)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                Task { await viewModel.deleteConversation(conversation) }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }
            }
            .navigationTitle("Messages")
            .navigationDestination(for: String.self) { conversationId in
                if let conversation = viewModel.conversations.first(where: { $0.id == conversationId }) {
                    SMSConversationView(viewModel: viewModel, conversation: conversation)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    NavigationLink {
                        SMSForwardConfigView(viewModel: SMSForwardViewModel(client: client, authManager: authManager))
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    HStack(spacing: 24) {
                        Button {
                            showCall = true
                        } label: {
                            Image(systemName: "phone")
                        }
                        Button {
                            showCompose = true
                        } label: {
                            Image(systemName: "square.and.pencil")
                        }
                    }
                }
            }
            .refreshable { await viewModel.refresh() }
            .overlay {
                if viewModel.isLoading && viewModel.conversations.isEmpty {
                    ProgressView()
                } else if !viewModel.isLoading && viewModel.conversations.isEmpty && viewModel.error == nil {
                    ContentUnavailableView(
                        "No Messages",
                        systemImage: "message",
                        description: Text("SMS messages will appear here")
                    )
                }
            }
            .sheet(isPresented: $showCompose) {
                SMSComposeView(viewModel: viewModel)
            }
            .fullScreenCover(isPresented: $showCall) {
                CallView(viewModel: CallViewModel(client: client, authManager: authManager))
            }
            .task { await viewModel.refresh() }
        }
    }
}

// MARK: - Conversation Row

private struct SMSConversationRow: View {
    let conversation: SMSConversation

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(conversation.number)
                        .font(.body.weight(conversation.unreadCount > 0 ? .bold : .medium))
                        .lineLimit(1)
                    Spacer()
                    Text(conversation.latestTime, style: .relative)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                HStack {
                    Text(conversation.latestMessage)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                    Spacer()
                    if conversation.unreadCount > 0 {
                        Text("\(conversation.unreadCount)")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.blue, in: Capsule())
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }
}
