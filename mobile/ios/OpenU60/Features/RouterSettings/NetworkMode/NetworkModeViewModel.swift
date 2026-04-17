import SwiftUI

@Observable
@MainActor
final class NetworkModeViewModel {
    var config: NetworkModeConfig = .empty
    var isLoading: Bool = false
    var message: String?
    var messageIsError: Bool = false

    var selectedNetSelect: String = NetworkModeConfig.netSelectOptions[0].value

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
            let data = try await client.getJSON("/api/network/signal")
            config = NetworkModeParser.parse(data)
            selectedNetSelect = config.netSelect
        } catch {
            showMessage("Failed to load network mode: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func applyMode() async {
        isLoading = true

        do {
            if selectedNetSelect != config.netSelect {
                let _ = try await client.putJSON("/api/modem/network-mode", body: ["net_select": selectedNetSelect])
            }
            // Poll until the router confirms the new value (up to ~10s)
            let expectedNet = selectedNetSelect
            for _ in 0..<5 {
                try? await Task.sleep(for: .seconds(2))
                let data = try await client.getJSON("/api/network/signal")
                let fetched = NetworkModeParser.parse(data)
                if fetched.netSelect == expectedNet {
                    config = fetched
                    showMessage("Network mode updated", isError: false)
                    isLoading = false
                    return
                }
            }

            config = NetworkModeConfig(netSelect: expectedNet)
            showMessage("Mode sent — router may still be switching", isError: false)
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
