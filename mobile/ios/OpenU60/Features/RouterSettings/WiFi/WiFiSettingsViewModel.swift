import SwiftUI

@Observable
@MainActor
final class WiFiSettingsViewModel {
    var config: WiFiConfig = .empty
    var isLoading: Bool = false
    var message: String?
    var messageIsError: Bool = false

    // Editable fields
    var editSSID2g: String = ""
    var editSSID5g: String = ""
    var editKey2g: String = ""
    var editKey5g: String = ""
    var editChannel2g: String = "auto"
    var editChannel5g: String = "auto"
    var editTxpower2g: String = "100"
    var editTxpower5g: String = "100"
    var editEncryption2g: String = "psk2+ccmp"
    var editEncryption5g: String = "psk2+ccmp"
    var editHidden2g: Bool = false
    var editHidden5g: Bool = false
    var editWifiOnOff: Bool = true
    var editRadio2gDisabled: Bool = false
    var editRadio5gDisabled: Bool = false
    var editWifi7Enabled: Bool = false
    var editBandwidth2g: String = "auto"
    var editBandwidth5g: String = "auto"

    private let client: AgentClient
    private let authManager: AuthManager

    init(client: AgentClient, authManager: AuthManager) {
        self.client = client
        self.authManager = authManager
    }

    func refresh() async {
        isLoading = true
        message = nil

        // Try native /api/wifi/status first (single call, all fields)
        if let wifiData = try? await client.getJSON("/api/wifi/status"),
           wifiData["htmode_2g"] != nil {
            config = WiFiParser.parse(wifiData)
            syncEditFields()
            isLoading = false
            return
        }

        showMessage("Failed to load WiFi settings", isError: true)
        isLoading = false
    }

    func apply() async {
        isLoading = true
        let params: [String: Any] = [
            "ssid_2g": editSSID2g,
            "ssid_5g": editSSID5g,
            "key_2g": editKey2g,
            "key_5g": editKey5g,
            "channel_2g": editChannel2g,
            "channel_5g": editChannel5g,
            "txpower_2g": editTxpower2g,
            "txpower_5g": editTxpower5g,
            "encryption_2g": editEncryption2g,
            "encryption_5g": editEncryption5g,
            "hidden_2g": editHidden2g ? "1" : "0",
            "hidden_5g": editHidden5g ? "1" : "0",
            "wifi_onoff": editWifiOnOff ? "1" : "0",
            "radio2_disabled": editRadio2gDisabled ? "1" : "0",
            "radio5_disabled": editRadio5gDisabled ? "1" : "0",
            "wifi6_switch": editWifi7Enabled ? "1" : "0",
            "htmode_2g": editBandwidth2g,
            "htmode_5g": editBandwidth5g
        ]

        do {
            let _ = try await client.putJSON("/api/wifi/settings", body: params)
            showMessage("WiFi settings applied — WiFi will restart briefly", isError: false)
            updateConfigFromEdits()
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    private func updateConfigFromEdits() {
        config = WiFiConfig(ssid2g: editSSID2g, ssid5g: editSSID5g, key2g: editKey2g, key5g: editKey5g,
                            channel2g: editChannel2g, channel5g: editChannel5g,
                            txpower2g: editTxpower2g, txpower5g: editTxpower5g,
                            encryption2g: editEncryption2g, encryption5g: editEncryption5g,
                            wifiOnOff: editWifiOnOff, hidden2g: editHidden2g, hidden5g: editHidden5g,
                            radio2gDisabled: editRadio2gDisabled, radio5gDisabled: editRadio5gDisabled,
                            wifi7Enabled: editWifi7Enabled, bandwidth2g: editBandwidth2g, bandwidth5g: editBandwidth5g)
    }

    private func syncEditFields() {
        editSSID2g = config.ssid2g
        editSSID5g = config.ssid5g
        editKey2g = config.key2g
        editKey5g = config.key5g
        editChannel2g = config.channel2g
        editChannel5g = config.channel5g
        editTxpower2g = config.txpower2g
        editTxpower5g = config.txpower5g
        editEncryption2g = config.encryption2g
        editEncryption5g = config.encryption5g
        editHidden2g = config.hidden2g
        editHidden5g = config.hidden5g
        editWifiOnOff = config.wifiOnOff
        editRadio2gDisabled = config.radio2gDisabled
        editRadio5gDisabled = config.radio5gDisabled
        editWifi7Enabled = config.wifi7Enabled
        editBandwidth2g = config.bandwidth2g
        editBandwidth5g = config.bandwidth5g
    }

    private func showMessage(_ text: String, isError: Bool) {
        message = text
        messageIsError = isError
    }
}
