import SwiftUI
import os

private let logger = Logger(subsystem: "com.zte.companion", category: "USBConnection")

@Observable
@MainActor
final class USBConnectionViewModel {
    var usbStatus: USBStatus = .empty
    var showModeSheet: Bool = false
    var isLoading: Bool = false
    var message: String?
    var messageIsError: Bool = false

    private let client: AgentClient
    private let authManager: AuthManager
    private var pollTask: Task<Void, Never>?
    private var wasCableAttached: Bool = false

    init(client: AgentClient, authManager: AuthManager) {
        self.client = client
        self.authManager = authManager
    }

    func startPolling(interval: TimeInterval = 3.0) {
        stopPolling()
        pollTask = Task {
            while !Task.isCancelled {
                await refresh()
                try? await Task.sleep(for: .seconds(interval))
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    func refresh() async {
        var usbData = await fetchUSB()

        if usbData == nil, await authManager.reauthenticate() {
            usbData = await fetchUSB()
        }

        guard let usb = usbData else { return }

        let charger = await fetchCharger()
        let status = DeviceParser.parseUSBStatus(usb, chargerData: charger)

        if status.cableAttached && !wasCableAttached {
            showModeSheet = true
        }
        wasCableAttached = status.cableAttached

        if status != usbStatus { usbStatus = status }
    }

    func enablePowerbank() async {
        isLoading = true
        message = nil
        do {
            let _ = try await client.putJSON("/api/usb/powerbank", body: ["state": 1])
            usbStatus.powerbankActive = true
            message = "Fast charging enabled"
            messageIsError = false
        } catch {
            message = "Failed: \(error.localizedDescription)"
            messageIsError = true
        }
        isLoading = false
    }

    func disablePowerbank() async {
        isLoading = true
        message = nil
        do {
            let _ = try await client.putJSON("/api/usb/powerbank", body: ["state": 0])
            usbStatus.powerbankActive = false
            message = "Fast charging disabled"
            messageIsError = false
        } catch {
            message = "Failed: \(error.localizedDescription)"
            messageIsError = true
        }
        isLoading = false
    }

    private func fetchUSB() async -> [String: Any]? {
        try? await client.getJSON("/api/usb/status")
    }

    private func fetchCharger() async -> [String: Any]? {
        try? await client.getJSON("/api/device/charger")
    }
}
