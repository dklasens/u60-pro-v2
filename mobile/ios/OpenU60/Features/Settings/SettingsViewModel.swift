import SwiftUI

@Observable
@MainActor
final class SettingsViewModel {
    var gatewayIP: String {
        didSet { UserDefaults.standard.set(gatewayIP, forKey: "gateway_ip") }
    }
    var pollInterval: Double {
        didSet { UserDefaults.standard.set(pollInterval, forKey: "poll_interval") }
    }
    var darkModeOverride: Int {
        didSet { UserDefaults.standard.set(darkModeOverride, forKey: "dark_mode_override") }
    }

    var passwordInput: String = ""
    var showSavedConfirmation: Bool = false
    var isDetectingGateway: Bool = false

    private let client: AgentClient

    var hasStoredPassword: Bool {
        KeychainHelper.load(key: "router_password") != nil
    }

    init(client: AgentClient) {
        self.client = client
        self.gatewayIP = UserDefaults.standard.string(forKey: "gateway_ip") ?? "192.168.0.1"
        let stored = UserDefaults.standard.double(forKey: "poll_interval")
        self.pollInterval = stored > 0 ? stored : 2.0
        self.darkModeOverride = UserDefaults.standard.integer(forKey: "dark_mode_override")
    }

    func savePassword() {
        guard !passwordInput.isEmpty else { return }
        KeychainHelper.save(key: "router_password", value: passwordInput)
        passwordInput = ""
        showSavedConfirmation = true
    }

    func clearPassword() {
        KeychainHelper.delete(key: "router_password")
        passwordInput = ""
    }

    func autoDetectGateway() async {
        isDetectingGateway = true
        defer { isDetectingGateway = false }
        let candidates = ["192.168.0.1", "192.168.1.1", "192.168.2.1", "10.0.0.1"]
        for ip in candidates {
            client.baseURL = "http://\(ip):9090"
            if await client.ping() {
                gatewayIP = ip
                return
            }
        }
    }
}
