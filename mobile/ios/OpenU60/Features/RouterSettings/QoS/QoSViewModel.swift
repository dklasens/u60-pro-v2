import SwiftUI

@Observable
@MainActor
final class QoSViewModel {
    var config: QoSConfig = .empty
    var isLoading: Bool = false
    var message: String?
    var messageIsError: Bool = false

    private let client: AgentClient
    private let authManager: AuthManager

    init(client: AgentClient, authManager: AuthManager) {
        self.client = client
        self.authManager = authManager
    }

    func refresh() async {
        isLoading = true
        message = nil

        do {
            let data = try await client.getJSON("/api/router/qos")
            config = QoSParser.parse(data)
        } catch {
            showMessage("Failed to load QoS: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func toggle(enabled: Bool) async {
        isLoading = true

        do {
            let _ = try await client.putJSON("/api/router/qos", body: ["qos_switch": enabled ? "1" : "0"])
            showMessage("QoS \(enabled ? "enabled" : "disabled")", isError: false)
            config = QoSConfig(enabled: enabled)
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    private func showMessage(_ text: String, isError: Bool) {
        message = text
        messageIsError = isError
    }
}
