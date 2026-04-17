import SwiftUI

struct SMSConversationView: View {
    var viewModel: SMSViewModel
    let conversation: SMSConversation
    @State private var messageText = ""
    @FocusState private var isInputFocused: Bool

    private var messages: [SMSMessage] {
        viewModel.conversations.first(where: { $0.id == conversation.id })?.messages ?? conversation.messages
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(messages) { message in
                            SMSBubbleView(message: message)
                                .id(message.id)
                        }
                        // Invisible anchor for scrolling
                        Color.clear
                            .frame(height: 1)
                            .id("bottom")
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                }
                .onAppear {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
                .onChange(of: messages.count) {
                    withAnimation {
                        proxy.scrollTo("bottom", anchor: .bottom)
                    }
                }
            }

            Divider()

            // Input bar
            HStack(spacing: 8) {
                TextField("Message", text: $messageText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...5)
                    .focused($isInputFocused)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 20))

                Button {
                    let text = messageText
                    messageText = ""
                    Task {
                        await viewModel.sendSMS(to: conversation.number, message: text)
                    }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                }
                .disabled(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.isSending)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(.systemBackground))
        }
        .navigationTitle(conversation.number)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                if viewModel.isSending {
                    ProgressView()
                }
            }
        }
        .task {
            // Mark unread messages as read when conversation is opened
            let unreadIds = messages.filter { $0.tag == .unread }.map(\.id)
            await viewModel.markAsRead(ids: unreadIds)
        }
    }
}

// MARK: - Bubble View

private struct SMSBubbleView: View {
    let message: SMSMessage

    private var isOutgoing: Bool { !message.tag.isIncoming }

    var body: some View {
        HStack {
            if isOutgoing { Spacer(minLength: 60) }

            VStack(alignment: isOutgoing ? .trailing : .leading, spacing: 2) {
                Text(message.content)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(bubbleColor, in: RoundedRectangle(cornerRadius: 16))
                    .foregroundStyle(isOutgoing ? .white : .primary)

                HStack(spacing: 4) {
                    if message.tag == .failed {
                        Image(systemName: "exclamationmark.circle.fill")
                            .foregroundStyle(.red)
                            .font(.caption2)
                    }
                    Text(message.date, style: .time)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            if !isOutgoing { Spacer(minLength: 60) }
        }
    }

    private var bubbleColor: Color {
        switch message.tag {
        case .failed: return .red
        case .sent: return .blue
        case .draft: return .orange
        default: return Color(.systemGray5)
        }
    }
}
