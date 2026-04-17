import SwiftUI

@Observable
@MainActor
final class DeviceControlViewModel {
    var isLoading: Bool = false
    var message: String?
    var messageIsError: Bool = false
    var showRebootConfirm: Bool = false
    var showFactoryResetConfirm: Bool = false
    var chargeLimitEnabled: Bool = false
    var chargeLimit: Int = 100
    var hysteresis: Int = 5
    var powerSaveEnabled: Bool = false
    var fastBootEnabled: Bool = false
    private var chargeControlLoaded: Bool = false
    private var powerSaveLoaded: Bool = false
    private var fastBootLoaded: Bool = false
    private let client: AgentClient
    private let authManager: AuthManager

    init(client: AgentClient, authManager: AuthManager) {
        self.client = client
        self.authManager = authManager
    }

    func refresh() async {
        do {
            let resp = try await client.getJSON("/api/device/charge-control")
            let data = resp["data"] as? [String: Any] ?? resp
            if let enabled = data["charge_limit_enabled"] as? Bool {
                chargeLimitEnabled = enabled
            }
            if let limit = data["charge_limit"] as? Int {
                chargeLimit = limit
            }
            if let hyst = data["hysteresis"] as? Int {
                hysteresis = hyst
            }
            chargeControlLoaded = true
        } catch {
            showMessage("Failed to load charge control status", isError: true)
        }

        do {
            let psData = try await client.postJSON("/api/device/power-save", body: ["deviceInfoList": ["power_saver_mode"]])
            let psMode = psData["power_saver_mode"] as? String ?? ""
            if !psMode.isEmpty {
                let newPowerSave = (psMode == "1")
                if newPowerSave != powerSaveEnabled { powerSaveEnabled = newPowerSave }
            }
            powerSaveLoaded = true
        } catch {
            showMessage("Failed to load power-save settings", isError: true)
        }

        do {
            let fbData = try await client.getJSON("/api/device/fast-boot")
            let data = fbData["data"] as? [String: Any] ?? fbData
            let fbMode = data["fast_boot"] as? String ?? ""
            if !fbMode.isEmpty {
                let newFastBoot = (fbMode == "1")
                if newFastBoot != fastBootEnabled { fastBootEnabled = newFastBoot }
            }
            fastBootLoaded = true
        } catch {
            showMessage("Failed to load fast boot settings", isError: true)
        }
    }

    func setChargeLimit(enabled: Bool, limit: Int, hysteresis: Int? = nil) async {
        guard chargeControlLoaded else { return }
        let prevEnabled = chargeLimitEnabled
        let prevLimit = chargeLimit
        let prevHysteresis = self.hysteresis
        isLoading = true
        do {
            var body: [String: Any] = [
                "charge_limit_enabled": enabled,
                "charge_limit": limit,
            ]
            if let hyst = hysteresis {
                body["hysteresis"] = hyst
            }
            let resp = try await client.putJSON("/api/device/charge-control", body: body)
            let data = (resp["data"] as? [String: Any]) ?? resp
            if let newEnabled = data["charge_limit_enabled"] as? Bool {
                chargeLimitEnabled = newEnabled
            }
            if let newLimit = data["charge_limit"] as? Int {
                chargeLimit = newLimit
            }
            if let newHyst = data["hysteresis"] as? Int {
                self.hysteresis = newHyst
            }
            showMessage(enabled ? "Charge limit set to \(limit)%" : "Charge limit disabled", isError: false)
        } catch {
            chargeLimitEnabled = prevEnabled
            chargeLimit = prevLimit
            self.hysteresis = prevHysteresis
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }
        isLoading = false
    }

    func setPowerSave(enabled: Bool) async {
        guard powerSaveLoaded else { return }
        isLoading = true
        do {
            let _ = try await client.putJSON("/api/device/power-save", body: ["deviceInfoList": ["power_saver_mode": enabled ? "1" : "0"]])
            showMessage(enabled ? "Power-save mode enabled" : "Power-save mode disabled", isError: false)
        } catch {
            powerSaveEnabled = !enabled
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }
        isLoading = false
    }

    func setFastBoot(enabled: Bool) async {
        guard fastBootLoaded else { return }
        isLoading = true
        do {
            let _ = try await client.putJSON("/api/device/fast-boot", body: ["fast_boot": enabled ? "1" : "0"])
            showMessage(enabled ? "Fast boot enabled" : "Fast boot disabled", isError: false)
        } catch {
            fastBootEnabled = !enabled
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }
        isLoading = false
    }

    func reboot() async {
        isLoading = true

        do {
            let _ = try await client.postJSON("/api/device/reboot")
            showMessage("Router is rebooting...", isError: false)
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func factoryReset() async {
        isLoading = true

        do {
            let _ = try await client.postJSON("/api/device/factory-reset")
            showMessage("Factory reset initiated...", isError: false)
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
