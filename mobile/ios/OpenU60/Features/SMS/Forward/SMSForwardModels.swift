import Foundation

struct SmsForwardConfig: Sendable {
    var enabled: Bool = false
    var pollIntervalSecs: Int = 30
    var markReadAfterForward: Bool = false
    var deleteAfterForward: Bool = false
    var rules: [ForwardRule] = []
}

struct ForwardRule: Identifiable, Sendable {
    let id: Int
    var name: String
    var enabled: Bool
    var filter: SmsFilter
    var destination: ForwardDestination
}

enum SmsFilter: Sendable {
    case all
    case sender(patterns: [String])
    case content(keywords: [String])
    case senderAndContent(patterns: [String], keywords: [String])
}

enum ForwardDestination: Sendable {
    case telegram(botToken: String, chatId: String, silent: Bool)
    case webhook(url: String, method: String, headers: [(String, String)])
    case sms(forwardNumber: String)
    case ntfy(url: String, topic: String, token: String?)
    case discord(webhookUrl: String)
    case slack(webhookUrl: String)
}

struct ForwardLogEntry: Identifiable, Sendable {
    let id: String
    let timestamp: Int
    let smsId: Int
    let sender: String
    let contentPreview: String
    let ruleName: String
    let destinationType: String
    let success: Bool
    let error: String?
}

// MARK: - Parsing & Serialization

enum SMSForwardParser {

    // MARK: Config

    static func parseConfig(_ data: [String: Any]) -> SmsForwardConfig {
        var config = SmsForwardConfig()
        config.enabled = data["enabled"] as? Bool ?? false
        config.pollIntervalSecs = parseIntValue(data["poll_interval_secs"]) ?? 30
        config.markReadAfterForward = data["mark_read_after_forward"] as? Bool ?? false
        config.deleteAfterForward = data["delete_after_forward"] as? Bool ?? false
        if let rulesArray = data["rules"] as? [[String: Any]] {
            config.rules = rulesArray.compactMap { parseRule($0) }
        }
        return config
    }

    // MARK: Rule

    static func parseRule(_ data: [String: Any]) -> ForwardRule? {
        guard let id = parseIntValue(data["id"]),
              let name = data["name"] as? String else {
            return nil
        }
        let enabled = data["enabled"] as? Bool ?? true
        let filter: SmsFilter
        if let filterDict = data["filter"] as? [String: Any] {
            filter = parseFilter(filterDict)
        } else {
            filter = .all
        }
        guard let destDict = data["destination"] as? [String: Any],
              let destination = parseDestination(destDict) else {
            return nil
        }
        return ForwardRule(id: id, name: name, enabled: enabled, filter: filter, destination: destination)
    }

    // MARK: Filter

    static func parseFilter(_ data: [String: Any]) -> SmsFilter {
        let type = data["type"] as? String ?? "all"
        switch type {
        case "sender":
            let patterns = data["patterns"] as? [String] ?? []
            return .sender(patterns: patterns)
        case "content":
            let keywords = data["keywords"] as? [String] ?? []
            return .content(keywords: keywords)
        case "sender_and_content":
            let patterns = data["patterns"] as? [String] ?? []
            let keywords = data["keywords"] as? [String] ?? []
            return .senderAndContent(patterns: patterns, keywords: keywords)
        default:
            return .all
        }
    }

    // MARK: Destination

    static func parseDestination(_ data: [String: Any]) -> ForwardDestination? {
        guard let type = data["type"] as? String else { return nil }
        switch type {
        case "telegram":
            let botToken = data["bot_token"] as? String ?? ""
            let chatId = data["chat_id"] as? String ?? ""
            let silent = data["silent"] as? Bool ?? false
            return .telegram(botToken: botToken, chatId: chatId, silent: silent)
        case "webhook":
            let url = data["url"] as? String ?? ""
            let method = data["method"] as? String ?? "POST"
            var headers: [(String, String)] = []
            if let headersArray = data["headers"] as? [[String: Any]] {
                for h in headersArray {
                    if let name = h["name"] as? String, let value = h["value"] as? String {
                        headers.append((name, value))
                    }
                }
            }
            return .webhook(url: url, method: method, headers: headers)
        case "sms":
            let forwardNumber = data["forward_number"] as? String ?? ""
            return .sms(forwardNumber: forwardNumber)
        case "ntfy":
            let url = data["url"] as? String ?? ""
            let topic = data["topic"] as? String ?? ""
            let token = data["token"] as? String
            return .ntfy(url: url, topic: topic, token: token)
        case "discord":
            let webhookUrl = data["webhook_url"] as? String ?? ""
            return .discord(webhookUrl: webhookUrl)
        case "slack":
            let webhookUrl = data["webhook_url"] as? String ?? ""
            return .slack(webhookUrl: webhookUrl)
        default:
            return nil
        }
    }

    // MARK: Log Entry

    static func parseLogEntry(_ data: [String: Any]) -> ForwardLogEntry? {
        guard let timestamp = parseIntValue(data["timestamp"]),
              let smsId = parseIntValue(data["sms_id"]) else {
            return nil
        }
        return ForwardLogEntry(
            id: "\(timestamp)-\(smsId)",
            timestamp: timestamp,
            smsId: smsId,
            sender: data["sender"] as? String ?? "",
            contentPreview: data["content_preview"] as? String ?? "",
            ruleName: data["rule_name"] as? String ?? "",
            destinationType: data["destination_type"] as? String ?? "",
            success: data["success"] as? Bool ?? false,
            error: data["error"] as? String
        )
    }

    // MARK: Serialization

    static func filterToDict(_ filter: SmsFilter) -> [String: Any] {
        switch filter {
        case .all:
            return ["type": "all"]
        case .sender(let patterns):
            return ["type": "sender", "patterns": patterns]
        case .content(let keywords):
            return ["type": "content", "keywords": keywords]
        case .senderAndContent(let patterns, let keywords):
            return ["type": "sender_and_content", "patterns": patterns, "keywords": keywords]
        }
    }

    static func destinationToDict(_ dest: ForwardDestination) -> [String: Any] {
        switch dest {
        case .telegram(let botToken, let chatId, let silent):
            return ["type": "telegram", "bot_token": botToken, "chat_id": chatId, "silent": silent]
        case .webhook(let url, let method, let headers):
            let headersArray = headers.map { ["name": $0.0, "value": $0.1] }
            return ["type": "webhook", "url": url, "method": method, "headers": headersArray] as [String: Any]
        case .sms(let forwardNumber):
            return ["type": "sms", "forward_number": forwardNumber]
        case .ntfy(let url, let topic, let token):
            var dict: [String: Any] = ["type": "ntfy", "url": url, "topic": topic]
            if let token, !token.isEmpty {
                dict["token"] = token
            }
            return dict
        case .discord(let webhookUrl):
            return ["type": "discord", "webhook_url": webhookUrl]
        case .slack(let webhookUrl):
            return ["type": "slack", "webhook_url": webhookUrl]
        }
    }

    // MARK: Helpers

    private static func parseIntValue(_ value: Any?) -> Int? {
        if let intVal = value as? Int {
            return intVal
        }
        if let nsNum = value as? NSNumber {
            return nsNum.intValue
        }
        return nil
    }
}
