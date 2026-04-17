import Foundation

struct STKMenuItem: Identifiable, Equatable {
    let id: Int
    let label: String
}

struct STKMenu: Equatable {
    var title: String = ""
    var items: [STKMenuItem] = []
    var source: String = ""

    static let empty = STKMenu()
}

struct USSDResponse: Equatable {
    var response: String = ""
    var rawResponse: String = ""
    var status: Int = -1
    var dcs: Int = 15
    var sessionActive: Bool = false

    static let empty = USSDResponse()
}

enum STKParser {
    static func parseSTKMenu(_ data: [String: Any]) -> STKMenu {
        var menu = STKMenu()
        menu.title = data["title"] as? String ?? ""
        menu.source = data["source"] as? String ?? ""

        if let items = data["items"] as? [[String: Any]] {
            menu.items = items.compactMap { item in
                guard let label = item["label"] as? String else { return nil }
                let id = asInt(item["id"]) ?? 0
                return STKMenuItem(id: id, label: label)
            }
        }
        return menu
    }

    static func parseUSSDResponse(_ data: [String: Any]) -> USSDResponse {
        var resp = USSDResponse()
        resp.response = data["response"] as? String ?? ""
        resp.rawResponse = data["raw_response"] as? String ?? ""
        resp.status = asInt(data["status"]) ?? -1
        resp.dcs = asInt(data["dcs"]) ?? 15
        resp.sessionActive = data["session_active"] as? Bool ?? false
        return resp
    }

    static func parseError(_ data: [String: Any]) -> String? {
        data["error"] as? String
    }

    private static func asInt(_ val: Any?) -> Int? {
        if let i = val as? Int { return i }
        if let s = val as? String { return Int(s) }
        if let d = val as? Double { return Int(d) }
        return nil
    }
}
