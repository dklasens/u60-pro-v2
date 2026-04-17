import SwiftUI

@Observable
@MainActor
final class LANSettingsViewModel {
    var config: LANConfig = .empty
    var isLoading: Bool = false
    var message: String?
    var messageIsError: Bool = false

    // Editable fields
    var editLanIP: String = ""
    var editNetmask: String = ""
    var editDhcpEnabled: Bool = false
    var editDhcpStart: String = ""
    var editDhcpEnd: String = ""
    var editLeaseTime: String = ""

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
            let data = try await client.getJSON("/api/router/lan")
            config = LANParser.parse(data)
            syncEditFields()
        } catch {
            showMessage("Failed to load LAN: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func apply() async {
        guard !editLanIP.isEmpty else {
            showMessage("LAN IP is required", isError: true)
            return
        }

        isLoading = true

        do {
            let _ = try await client.putJSON("/api/router/lan", body: [
                "lan_ipaddr": editLanIP,
                "lan_netmask": editNetmask,
                "dhcp_enable": editDhcpEnabled ? "1" : "0",
                "dhcp_start": editDhcpStart,
                "dhcp_end": editDhcpEnd,
                "dhcp_lease_time": editLeaseTime
            ])
            showMessage("LAN settings updated", isError: false)
            config = LANConfig(lanIP: editLanIP, netmask: editNetmask, dhcpEnabled: editDhcpEnabled,
                               dhcpStart: editDhcpStart, dhcpEnd: editDhcpEnd, dhcpLeaseTime: editLeaseTime)
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    private func syncEditFields() {
        editLanIP = config.lanIP
        editNetmask = config.netmask
        editDhcpEnabled = config.dhcpEnabled
        editDhcpStart = config.dhcpStart
        editDhcpEnd = config.dhcpEnd
        editLeaseTime = config.dhcpLeaseTime
    }

    private func showMessage(_ text: String, isError: Bool) {
        message = text
        messageIsError = isError
    }
}
