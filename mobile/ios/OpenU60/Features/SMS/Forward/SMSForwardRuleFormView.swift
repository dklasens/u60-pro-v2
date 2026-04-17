import SwiftUI

struct SMSForwardRuleFormView: View {
    @Bindable var viewModel: SMSForwardViewModel
    let editingRule: ForwardRule?
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var filterType: String
    @State private var senderPatterns: String
    @State private var contentKeywords: String
    @State private var destType: String

    // Telegram
    @State private var botToken: String
    @State private var chatId: String
    @State private var silent: Bool

    // Webhook
    @State private var webhookUrl: String
    @State private var webhookMethod: String
    @State private var webhookHeaders: String

    // SMS
    @State private var forwardNumber: String

    // ntfy
    @State private var ntfyUrl: String
    @State private var ntfyTopic: String
    @State private var ntfyToken: String

    // Discord
    @State private var discordUrl: String

    // Slack
    @State private var slackUrl: String

    init(viewModel: SMSForwardViewModel, editingRule: ForwardRule? = nil) {
        self.viewModel = viewModel
        self.editingRule = editingRule

        if let rule = editingRule {
            _name = State(initialValue: rule.name)

            // Filter
            switch rule.filter {
            case .all:
                _filterType = State(initialValue: "all")
                _senderPatterns = State(initialValue: "")
                _contentKeywords = State(initialValue: "")
            case .sender(let patterns):
                _filterType = State(initialValue: "sender")
                _senderPatterns = State(initialValue: patterns.joined(separator: ", "))
                _contentKeywords = State(initialValue: "")
            case .content(let keywords):
                _filterType = State(initialValue: "content")
                _senderPatterns = State(initialValue: "")
                _contentKeywords = State(initialValue: keywords.joined(separator: ", "))
            case .senderAndContent(let patterns, let keywords):
                _filterType = State(initialValue: "sender_and_content")
                _senderPatterns = State(initialValue: patterns.joined(separator: ", "))
                _contentKeywords = State(initialValue: keywords.joined(separator: ", "))
            }

            // Destination
            switch rule.destination {
            case .telegram(let bt, let ci, let s):
                _destType = State(initialValue: "telegram")
                _botToken = State(initialValue: bt)
                _chatId = State(initialValue: ci)
                _silent = State(initialValue: s)
                _webhookUrl = State(initialValue: "")
                _webhookMethod = State(initialValue: "POST")
                _webhookHeaders = State(initialValue: "")
                _forwardNumber = State(initialValue: "")
                _ntfyUrl = State(initialValue: "https://ntfy.sh")
                _ntfyTopic = State(initialValue: "")
                _ntfyToken = State(initialValue: "")
                _discordUrl = State(initialValue: "")
                _slackUrl = State(initialValue: "")
            case .webhook(let url, let method, let headers):
                _destType = State(initialValue: "webhook")
                _botToken = State(initialValue: "")
                _chatId = State(initialValue: "")
                _silent = State(initialValue: false)
                _webhookUrl = State(initialValue: url)
                _webhookMethod = State(initialValue: method)
                _webhookHeaders = State(initialValue: headers.map { "\($0.0): \($0.1)" }.joined(separator: "\n"))
                _forwardNumber = State(initialValue: "")
                _ntfyUrl = State(initialValue: "https://ntfy.sh")
                _ntfyTopic = State(initialValue: "")
                _ntfyToken = State(initialValue: "")
                _discordUrl = State(initialValue: "")
                _slackUrl = State(initialValue: "")
            case .sms(let number):
                _destType = State(initialValue: "sms")
                _botToken = State(initialValue: "")
                _chatId = State(initialValue: "")
                _silent = State(initialValue: false)
                _webhookUrl = State(initialValue: "")
                _webhookMethod = State(initialValue: "POST")
                _webhookHeaders = State(initialValue: "")
                _forwardNumber = State(initialValue: number)
                _ntfyUrl = State(initialValue: "https://ntfy.sh")
                _ntfyTopic = State(initialValue: "")
                _ntfyToken = State(initialValue: "")
                _discordUrl = State(initialValue: "")
                _slackUrl = State(initialValue: "")
            case .ntfy(let url, let topic, let token):
                _destType = State(initialValue: "ntfy")
                _botToken = State(initialValue: "")
                _chatId = State(initialValue: "")
                _silent = State(initialValue: false)
                _webhookUrl = State(initialValue: "")
                _webhookMethod = State(initialValue: "POST")
                _webhookHeaders = State(initialValue: "")
                _forwardNumber = State(initialValue: "")
                _ntfyUrl = State(initialValue: url)
                _ntfyTopic = State(initialValue: topic)
                _ntfyToken = State(initialValue: token ?? "")
                _discordUrl = State(initialValue: "")
                _slackUrl = State(initialValue: "")
            case .discord(let url):
                _destType = State(initialValue: "discord")
                _botToken = State(initialValue: "")
                _chatId = State(initialValue: "")
                _silent = State(initialValue: false)
                _webhookUrl = State(initialValue: "")
                _webhookMethod = State(initialValue: "POST")
                _webhookHeaders = State(initialValue: "")
                _forwardNumber = State(initialValue: "")
                _ntfyUrl = State(initialValue: "https://ntfy.sh")
                _ntfyTopic = State(initialValue: "")
                _ntfyToken = State(initialValue: "")
                _discordUrl = State(initialValue: url)
                _slackUrl = State(initialValue: "")
            case .slack(let url):
                _destType = State(initialValue: "slack")
                _botToken = State(initialValue: "")
                _chatId = State(initialValue: "")
                _silent = State(initialValue: false)
                _webhookUrl = State(initialValue: "")
                _webhookMethod = State(initialValue: "POST")
                _webhookHeaders = State(initialValue: "")
                _forwardNumber = State(initialValue: "")
                _ntfyUrl = State(initialValue: "https://ntfy.sh")
                _ntfyTopic = State(initialValue: "")
                _ntfyToken = State(initialValue: "")
                _discordUrl = State(initialValue: "")
                _slackUrl = State(initialValue: url)
            }
        } else {
            _name = State(initialValue: "")
            _filterType = State(initialValue: "all")
            _senderPatterns = State(initialValue: "")
            _contentKeywords = State(initialValue: "")
            _destType = State(initialValue: "telegram")
            _botToken = State(initialValue: "")
            _chatId = State(initialValue: "")
            _silent = State(initialValue: false)
            _webhookUrl = State(initialValue: "")
            _webhookMethod = State(initialValue: "POST")
            _webhookHeaders = State(initialValue: "")
            _forwardNumber = State(initialValue: "")
            _ntfyUrl = State(initialValue: "https://ntfy.sh")
            _ntfyTopic = State(initialValue: "")
            _ntfyToken = State(initialValue: "")
            _discordUrl = State(initialValue: "")
            _slackUrl = State(initialValue: "")
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("Rule name", text: $name)
                }

                Section("Filter") {
                    Picker("Type", selection: $filterType) {
                        Text("All Messages").tag("all")
                        Text("By Sender").tag("sender")
                        Text("By Content").tag("content")
                        Text("Sender + Content").tag("sender_and_content")
                    }

                    if filterType == "sender" || filterType == "sender_and_content" {
                        TextField("Sender patterns (comma-separated)", text: $senderPatterns)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }

                    if filterType == "content" || filterType == "sender_and_content" {
                        TextField("Keywords (comma-separated)", text: $contentKeywords)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                }

                Section("Destination") {
                    Picker("Type", selection: $destType) {
                        Text("Telegram").tag("telegram")
                        Text("Webhook").tag("webhook")
                        Text("SMS").tag("sms")
                        Text("ntfy").tag("ntfy")
                        Text("Discord").tag("discord")
                        Text("Slack").tag("slack")
                    }

                    switch destType {
                    case "telegram":
                        TextField("Bot Token", text: $botToken)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        TextField("Chat ID", text: $chatId)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Toggle("Silent", isOn: $silent)
                    case "webhook":
                        TextField("URL", text: $webhookUrl)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                        Picker("Method", selection: $webhookMethod) {
                            Text("POST").tag("POST")
                            Text("PUT").tag("PUT")
                        }
                        TextField("Headers (name: value, one per line)", text: $webhookHeaders, axis: .vertical)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .lineLimit(3...6)
                    case "sms":
                        TextField("Forward to number", text: $forwardNumber)
                            .keyboardType(.phonePad)
                    case "ntfy":
                        TextField("Server URL", text: $ntfyUrl)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                        TextField("Topic", text: $ntfyTopic)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        TextField("Token (optional)", text: $ntfyToken)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    case "discord":
                        TextField("Webhook URL", text: $discordUrl)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                    case "slack":
                        TextField("Webhook URL", text: $slackUrl)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                    default:
                        EmptyView()
                    }
                }

                Section {
                    Button {
                        Task { await viewModel.testDestination(buildDestination()) }
                    } label: {
                        Label("Test Destination", systemImage: "paperplane")
                    }
                    .disabled(!isDestValid)
                }

                Section {
                    Button {
                        Task {
                            await save()
                            dismiss()
                        }
                    } label: {
                        Text("Save")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(name.isEmpty || !isDestValid)
                }
            }
            .navigationTitle(editingRule != nil ? "Edit Rule" : "New Rule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    // MARK: - Helpers

    private var isDestValid: Bool {
        switch destType {
        case "telegram":
            return !botToken.isEmpty && !chatId.isEmpty
        case "webhook":
            return !webhookUrl.isEmpty
        case "sms":
            return !forwardNumber.isEmpty
        case "ntfy":
            return !ntfyUrl.isEmpty && !ntfyTopic.isEmpty
        case "discord":
            return !discordUrl.isEmpty
        case "slack":
            return !slackUrl.isEmpty
        default:
            return false
        }
    }

    private func buildFilter() -> SmsFilter {
        switch filterType {
        case "sender":
            return .sender(patterns: splitCSV(senderPatterns))
        case "content":
            return .content(keywords: splitCSV(contentKeywords))
        case "sender_and_content":
            return .senderAndContent(patterns: splitCSV(senderPatterns), keywords: splitCSV(contentKeywords))
        default:
            return .all
        }
    }

    private func buildDestination() -> ForwardDestination {
        switch destType {
        case "telegram":
            return .telegram(botToken: botToken.trimmingCharacters(in: .whitespaces),
                             chatId: chatId.trimmingCharacters(in: .whitespaces),
                             silent: silent)
        case "webhook":
            return .webhook(url: webhookUrl.trimmingCharacters(in: .whitespaces),
                            method: webhookMethod,
                            headers: parseHeaders(webhookHeaders))
        case "sms":
            return .sms(forwardNumber: forwardNumber.trimmingCharacters(in: .whitespaces))
        case "ntfy":
            let token = ntfyToken.trimmingCharacters(in: .whitespaces)
            return .ntfy(url: ntfyUrl.trimmingCharacters(in: .whitespaces),
                         topic: ntfyTopic.trimmingCharacters(in: .whitespaces),
                         token: token.isEmpty ? nil : token)
        case "discord":
            return .discord(webhookUrl: discordUrl.trimmingCharacters(in: .whitespaces))
        case "slack":
            return .slack(webhookUrl: slackUrl.trimmingCharacters(in: .whitespaces))
        default:
            return .telegram(botToken: "", chatId: "", silent: false)
        }
    }

    private func save() async {
        let filter = buildFilter()
        let destination = buildDestination()

        if let rule = editingRule {
            await viewModel.updateRule(id: rule.id, name: name, enabled: rule.enabled,
                                       filter: filter, destination: destination)
        } else {
            await viewModel.createRule(name: name, filter: filter, destination: destination)
        }
    }

    private func splitCSV(_ text: String) -> [String] {
        text.split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    private func parseHeaders(_ text: String) -> [(String, String)] {
        text.split(separator: "\n").compactMap { line in
            let parts = line.split(separator: ":", maxSplits: 1)
            guard parts.count == 2 else { return nil }
            return (parts[0].trimmingCharacters(in: .whitespaces),
                    parts[1].trimmingCharacters(in: .whitespaces))
        }
    }
}
