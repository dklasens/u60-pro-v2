import SwiftUI

@Observable
@MainActor
final class SMSForwardViewModel {
    var config = SmsForwardConfig()
    var lastForwardedId: Int = 0
    var log: [ForwardLogEntry] = []
    var isLoading = false
    var message: String?
    var messageIsError = false
    var presentedSheet: Sheet?

    enum Sheet: Identifiable {
        case add
        case edit(ForwardRule)
        var id: String {
            switch self {
            case .add: "add"
            case .edit(let r): "edit-\(r.id)"
            }
        }
    }

    private let client: AgentClient
    private let authManager: AuthManager

    init(client: AgentClient, authManager: AuthManager) {
        self.client = client
        self.authManager = authManager
    }

    // MARK: - Config

    func refresh() async {
        isLoading = true
        message = nil
        do {
            let data = try await client.getJSON("/api/sms/forward/config")
            if let configDict = data["config"] as? [String: Any] {
                config = SMSForwardParser.parseConfig(configDict)
            }
            lastForwardedId = (data["last_forwarded_id"] as? Int)
                ?? (data["last_forwarded_id"] as? NSNumber)?.intValue
                ?? 0
        } catch {
            showMessage("Failed to load: \(error.localizedDescription)", isError: true)
        }
        isLoading = false
    }

    func updateConfig(enabled: Bool, pollIntervalSecs: Int, markRead: Bool, deleteAfter: Bool) async {
        isLoading = true
        do {
            let body: [String: Any] = [
                "enabled": enabled,
                "poll_interval_secs": pollIntervalSecs,
                "mark_read_after_forward": markRead,
                "delete_after_forward": deleteAfter,
            ]
            let _ = try await client.putJSON("/api/sms/forward/config", body: body)
            config.enabled = enabled
            config.pollIntervalSecs = pollIntervalSecs
            config.markReadAfterForward = markRead
            config.deleteAfterForward = deleteAfter
            showMessage("Settings saved", isError: false)
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }
        isLoading = false
    }

    func toggleEnabled(_ enabled: Bool) async {
        let previous = config.enabled
        config.enabled = enabled  // optimistic
        do {
            let _ = try await client.putJSON("/api/sms/forward/config", body: [
                "enabled": enabled,
                "poll_interval_secs": config.pollIntervalSecs,
                "mark_read_after_forward": config.markReadAfterForward,
                "delete_after_forward": config.deleteAfterForward,
            ])
            config.enabled = enabled  // re-assert in case refresh() overwrote during await
        } catch {
            config.enabled = previous  // revert on failure
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }
    }

    // MARK: - Rules

    func createRule(name: String, filter: SmsFilter, destination: ForwardDestination) async {
        isLoading = true
        do {
            var body: [String: Any] = [
                "name": name,
                "filter": SMSForwardParser.filterToDict(filter),
                "destination": SMSForwardParser.destinationToDict(destination),
            ]
            body["enabled"] = true
            let _ = try await client.postJSON("/api/sms/forward/rules", body: body)
            showMessage("Rule created", isError: false)
            await refresh()
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }
        isLoading = false
    }

    func updateRule(id: Int, name: String, enabled: Bool, filter: SmsFilter, destination: ForwardDestination) async {
        isLoading = true
        do {
            let body: [String: Any] = [
                "id": id,
                "name": name,
                "enabled": enabled,
                "filter": SMSForwardParser.filterToDict(filter),
                "destination": SMSForwardParser.destinationToDict(destination),
            ]
            let _ = try await client.putJSON("/api/sms/forward/rules", body: body)
            showMessage("Rule updated", isError: false)
            await refresh()
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }
        isLoading = false
    }

    func deleteRule(id: Int) async {
        do {
            let _ = try await client.deleteJSON("/api/sms/forward/rules", body: ["id": id])
            config.rules.removeAll { $0.id == id }
            showMessage("Rule deleted", isError: false)
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }
    }

    func toggleRule(id: Int, enabled: Bool) async {
        do {
            let _ = try await client.putJSON("/api/sms/forward/rules/toggle", body: ["id": id, "enabled": enabled])
            if let idx = config.rules.firstIndex(where: { $0.id == id }) {
                config.rules[idx].enabled = enabled
            }
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }
    }

    // MARK: - Test

    func testDestination(_ destination: ForwardDestination) async {
        isLoading = true
        do {
            let body: [String: Any] = [
                "destination": SMSForwardParser.destinationToDict(destination),
            ]
            let _ = try await client.postJSON("/api/sms/forward/test", body: body)
            showMessage("Test message sent", isError: false)
        } catch {
            showMessage("Test failed: \(error.localizedDescription)", isError: true)
        }
        isLoading = false
    }

    // MARK: - Log

    func fetchLog() async {
        isLoading = true
        do {
            let data = try await client.getJSONArray("/api/sms/forward/log")
            log = data.compactMap { SMSForwardParser.parseLogEntry($0) }
        } catch {
            showMessage("Failed to load log: \(error.localizedDescription)", isError: true)
        }
        isLoading = false
    }

    func clearLog() async {
        do {
            let _ = try await client.postJSON("/api/sms/forward/log/clear")
            log = []
            showMessage("Log cleared", isError: false)
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }
    }

    // MARK: - Helpers

    private func showMessage(_ text: String, isError: Bool) {
        message = text
        messageIsError = isError
    }
}
