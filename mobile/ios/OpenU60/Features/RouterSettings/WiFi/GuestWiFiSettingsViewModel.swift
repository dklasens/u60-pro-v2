import SwiftUI

@Observable
@MainActor
final class GuestWiFiSettingsViewModel {
    var config: GuestWiFiConfig = .empty
    var isLoading: Bool = false
    var message: String?
    var messageIsError: Bool = false

    // Editable fields
    var editEnabled2g: Bool = false
    var editEnabled5g: Bool = false
    var editSsid: String = ""
    var editKey: String = ""
    var editEncryption: String = "psk2+ccmp"
    var editHidden: Bool = false
    var editIsolate: Bool = true
    var editActiveTime: Int = 0
    var remainingSeconds: Int = -1

    private let client: AgentClient
    private let authManager: AuthManager
    private var countdownTask: Task<Void, Never>?

    init(client: AgentClient, authManager: AuthManager) {
        self.client = client
        self.authManager = authManager
    }

    func refresh() async {
        isLoading = true
        message = nil

        // Try native agent guest endpoint first
        if let data = try? await client.getJSON("/api/wifi/guest"),
           data["ssid"] != nil {
            config = GuestWiFiParser.parse(data)
            syncEditFields()
            isLoading = false
            return
        }

        showMessage("Failed to load guest WiFi settings", isError: true)
        isLoading = false
    }

    func apply() async {
        isLoading = true
        let params: [String: Any] = [
            "guest_ssid": editSsid,
            "guest_key": editKey,
            "guest_encryption": editEncryption,
            "guest_disabled_2g": editEnabled2g ? "0" : "1",
            "guest_disabled_5g": editEnabled5g ? "0" : "1",
            "guest_hidden": editHidden ? "1" : "0",
            "guest_isolate": editIsolate ? "1" : "0",
            "guest_active_time": "\(editActiveTime)"
        ]

        do {
            let _ = try await client.putJSON("/api/wifi/guest", body: params)
            showMessage("Guest WiFi settings applied", isError: false)
            updateConfigFromEdits()
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    var remainingTimeText: String? {
        guard remainingSeconds > 0 else { return nil }
        let hours = remainingSeconds / 3600
        let minutes = (remainingSeconds % 3600) / 60
        let seconds = remainingSeconds % 60
        if hours > 0 {
            return String(format: "%dh %02dm %02ds remaining", hours, minutes, seconds)
        }
        return String(format: "%dm %02ds remaining", minutes, seconds)
    }

    var isAnyBandEnabled: Bool {
        editEnabled2g || editEnabled5g
    }

    var isTimerExpired: Bool {
        editActiveTime > 0 && !isAnyBandEnabled && remainingSeconds <= 0
    }

    private func updateConfigFromEdits() {
        config = GuestWiFiConfig(
            enabled2g: editEnabled2g, enabled5g: editEnabled5g, ssid: editSsid, key: editKey,
            encryption: editEncryption, hidden: editHidden,
            isolate: editIsolate, activeTime: editActiveTime,
            remainingSeconds: remainingSeconds
        )
    }

    private func syncEditFields() {
        editEnabled2g = config.enabled2g
        editEnabled5g = config.enabled5g
        editSsid = config.ssid
        editKey = config.key
        editEncryption = config.encryption
        editHidden = config.hidden
        editIsolate = config.isolate
        editActiveTime = config.activeTime

        let serverRemaining = config.remainingSeconds
        if remainingSeconds <= 0 {
            remainingSeconds = serverRemaining
            startCountdown()
        } else if serverRemaining <= 0 {
            remainingSeconds = 0
            countdownTask?.cancel()
        }
    }

    private func startCountdown() {
        countdownTask?.cancel()
        guard remainingSeconds > 0 else { return }
        countdownTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled, let self, self.remainingSeconds > 0 else { break }
                self.remainingSeconds -= 1
            }
        }
    }

    private func showMessage(_ text: String, isError: Bool) {
        message = text
        messageIsError = isError
    }
}
