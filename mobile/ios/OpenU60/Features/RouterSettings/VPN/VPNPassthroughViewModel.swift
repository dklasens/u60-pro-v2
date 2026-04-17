import SwiftUI

@Observable
@MainActor
final class VPNPassthroughViewModel {
    var config: VPNPassthroughConfig = .empty
    var isLoading: Bool = false
    var message: String?
    var messageIsError: Bool = false

    var editL2tp: Bool = false
    var editPptp: Bool = false
    var editIpsec: Bool = false

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
            let data = try await client.getJSON("/api/router/vpn")
            config = VPNPassthroughParser.parse(data)
            editL2tp = config.l2tp
            editPptp = config.pptp
            editIpsec = config.ipsec
        } catch {
            showMessage("Failed to load VPN: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func apply() async {
        isLoading = true

        do {
            let _ = try await client.putJSON("/api/router/vpn", body: [
                "l2tp_passthrough": editL2tp ? "1" : "0",
                "pptp_passthrough": editPptp ? "1" : "0",
                "ipsec_passthrough": editIpsec ? "1" : "0"
            ])
            showMessage("VPN passthrough updated", isError: false)
            config = VPNPassthroughConfig(l2tp: editL2tp, pptp: editPptp, ipsec: editIpsec)
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
