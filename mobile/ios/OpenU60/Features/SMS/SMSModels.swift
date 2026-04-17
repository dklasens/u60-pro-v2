import Foundation

// MARK: - Tag Enum

enum SMSTag: Int, Sendable {
    case read = 0
    case unread = 1
    case sent = 2
    case failed = 3
    case draft = 4

    var isIncoming: Bool { self == .read || self == .unread }
}

// MARK: - Storage Filter

enum SMSStorageFilter: String, CaseIterable, Sendable {
    case all = "All"
    case `internal` = "Internal"
    case sim = "SIM"

    var memStoreValue: Int {
        switch self {
        case .all: return 2
        case .internal: return 1
        case .sim: return 0
        }
    }
}

// MARK: - SMS Message

struct SMSMessage: Identifiable, Sendable {
    let id: Int
    let number: String
    let content: String
    let date: Date
    let tag: SMSTag
    let groupId: String
    let memStore: String
}

// MARK: - SMS Conversation

struct SMSConversation: Identifiable {
    var id: String { normalizedNumber }
    let normalizedNumber: String
    let number: String
    var messages: [SMSMessage]
    var unreadCount: Int
    var latestMessage: String
    var latestTime: Date
}

// MARK: - SMS Capacity

struct SMSCapacity {
    let nvTotal: Int
    let nvUsed: Int
    let simTotal: Int
    let simUsed: Int
    let unreadCount: Int

    static let empty = SMSCapacity(nvTotal: 0, nvUsed: 0, simTotal: 0, simUsed: 0, unreadCount: 0)
}

// MARK: - Parser

enum SMSParser {

    /// Decode UCS-2 hex string (UTF-16BE, 4 hex chars per character) to readable text.
    static func decodeUCS2Hex(_ hex: String) -> String {
        var result = ""
        let chars = Array(hex)
        var i = 0
        while i + 3 < chars.count {
            let hexStr = String(chars[i...i+3])
            if let scalar = UInt32(hexStr, radix: 16), let unicode = Unicode.Scalar(scalar) {
                result.append(Character(unicode))
            }
            i += 4
        }
        return result
    }

    /// Encode text to UCS-2 hex string (UTF-16BE).
    static func encodeUCS2Hex(_ text: String) -> String {
        text.utf16.map { String(format: "%04X", $0) }.joined()
    }

    /// Parse ZTE date format "YY,MM,DD,HH,MM,SS,TZ" to Date.
    static func parseSMSDate(_ dateStr: String) -> Date {
        let parts = dateStr.split(separator: ",").map(String.init)
        guard parts.count >= 6 else { return Date() }

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!

        let year = (Int(parts[0]) ?? 0) + 2000
        let month = Int(parts[1]) ?? 1
        let day = Int(parts[2]) ?? 1
        let hour = Int(parts[3]) ?? 0
        let minute = Int(parts[4]) ?? 0
        let second = Int(parts[5]) ?? 0

        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        components.hour = hour
        components.minute = minute
        components.second = second

        // Parse timezone offset if present (e.g. "+0", "+32" = +8h in quarter-hours)
        if parts.count >= 7 {
            let tzStr = parts[6].trimmingCharacters(in: .whitespaces)
            if let quarters = Int(tzStr) {
                let offsetSeconds = quarters * 15 * 60
                components.timeZone = TimeZone(secondsFromGMT: offsetSeconds)
            }
        }

        return calendar.date(from: components) ?? Date()
    }

    /// Format current time in ZTE SMS send format (semicolons, tz in hours).
    /// JS: "YY;MM;DD;HH;MM;SS;+TZ" where TZ is offset in hours.
    static func formatSMSTime() -> String {
        let now = Date()
        let calendar = Calendar(identifier: .gregorian)
        let tz = TimeZone.current
        let comps = calendar.dateComponents(in: tz, from: now)

        let year = (comps.year ?? 2026) % 100
        let offsetHours = tz.secondsFromGMT() / 3600
        let tzStr = offsetHours >= 0 ? "+\(offsetHours)" : "\(offsetHours)"

        return String(format: "%02d;%02d;%02d;%02d;%02d;%02d;%@",
                      year, comps.month ?? 1, comps.day ?? 1,
                      comps.hour ?? 0, comps.minute ?? 0, comps.second ?? 0, tzStr)
    }

    /// Determine encode type for sending.
    static func getEncodeType(_ text: String) -> String {
        // Check if all characters are in GSM 7-bit default alphabet
        let gsm7 = CharacterSet(charactersIn:
            "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ" +
            " !\"#¤%&'()*+,-./0123456789:;<=>?" +
            "¡ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
            "ÄÖÑÜabcdefghijklmnopqrstuvwxyz" +
            "äöñüà§")
        if text.unicodeScalars.allSatisfy({ gsm7.contains($0) }) {
            return "GSM7_default"
        }
        return "UNICODE"
    }

    /// Normalize phone number to last 8 digits for conversation grouping.
    static func normalizeNumber(_ number: String) -> String {
        let digits = number.filter(\.isNumber)
        if digits.count > 8 {
            return String(digits.suffix(8))
        }
        return digits
    }

    /// Group messages into conversations by normalized phone number.
    static func groupIntoConversations(_ messages: [SMSMessage]) -> [SMSConversation] {
        var grouped: [String: [SMSMessage]] = [:]

        for msg in messages {
            let key = normalizeNumber(msg.number)
            grouped[key, default: []].append(msg)
        }

        return grouped.map { key, msgs in
            let sorted = msgs.sorted { $0.date < $1.date }
            let latest = sorted.last!
            let unread = msgs.filter { $0.tag == .unread }.count
            // Use the longest number variant as display number
            let displayNumber = msgs.map(\.number).max(by: { $0.count < $1.count }) ?? latest.number

            return SMSConversation(
                normalizedNumber: key,
                number: displayNumber,
                messages: sorted,
                unreadCount: unread,
                latestMessage: latest.content,
                latestTime: latest.date
            )
        }.sorted { $0.latestTime > $1.latestTime }
    }

    /// Parse raw SMS data from the agent into SMSMessage array.
    /// Response format: { "messages": [ { "id":Int, "number":String, "content":String(UCS2hex),
    ///   "date":"YY,MM,DD,HH,MM,SS,TZ", "tag":"0".."4", "draft_group_id":String, "mem_store":String } ] }
    static func parseMessages(_ data: [String: Any]) -> [SMSMessage] {
        guard let list = data["messages"] as? [[String: Any]] else { return [] }

        return list.compactMap { item -> SMSMessage? in
            guard let id = item["id"] as? Int,
                  let number = item["number"] as? String,
                  let body = item["content"] as? String,
                  let dateStr = item["date"] as? String,
                  let tagStr = item["tag"] as? String,
                  let tagInt = Int(tagStr),
                  let tag = SMSTag(rawValue: tagInt) else { return nil }

            // Content is always UCS-2 hex encoded; decode it.
            // If decoding produces empty string, fall back to raw (might be GSM7 plain text).
            let decoded = decodeUCS2Hex(body)
            let content = decoded.isEmpty ? body : decoded

            return SMSMessage(
                id: id,
                number: number,
                content: content,
                date: parseSMSDate(dateStr),
                tag: tag,
                groupId: item["draft_group_id"] as? String ?? "",
                memStore: item["mem_store"] as? String ?? "nv"
            )
        }
    }

    /// Parse capacity response.
    static func parseCapacity(_ data: [String: Any]) -> SMSCapacity {
        SMSCapacity(
            nvTotal: data["sms_nv_total"] as? Int ?? 0,
            nvUsed: data["sms_nvused_total"] as? Int ?? 0,
            simTotal: data["sms_sim_total"] as? Int ?? 0,
            simUsed: data["sms_simused_total"] as? Int ?? 0,
            unreadCount: data["sms_dev_unread_num"] as? Int ?? 0
        )
    }
}
