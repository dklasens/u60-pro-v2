import SwiftUI
import os

private let logger = Logger(subsystem: "com.zte.companion", category: "Dashboard")

@Observable
@MainActor
final class DashboardViewModel {
    var nrSignal: NRSignal = .empty
    var lteSignal: LTESignal = .empty
    var operatorInfo: OperatorInfo = .empty
    var battery: BatteryStatus = .empty
    var thermal: ThermalStatus = .empty
    var speed: TrafficSpeed = .zero
    var trafficStats: TrafficStats = .empty
    var wanIPv4: String = ""
    var wanIPv6: String = ""
    var wifiStatus: WifiStatus = .empty
    var systemInfo: SystemInfo = .empty
    var connectedDevices: [ConnectedDevice] = []
    var isAirplaneMode: Bool = false
    var isMobileDataOff: Bool = false
    var isLoading: Bool = false
    var lastUpdated: Date?
    var error: String?
    var simPinRequired: Bool = false
    var simPukRequired: Bool = false

    private let client: AgentClient
    private let authManager: AuthManager
    private var pollTask: Task<Void, Never>?
    private var previousTraffic: TrafficStats?

    private static func isCancellation(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        if let agentError = error as? AgentError,
           case .networkError(let inner) = agentError,
           (inner as? URLError)?.code == .cancelled { return true }
        return false
    }

    init(client: AgentClient, authManager: AuthManager) {
        self.client = client
        self.authManager = authManager
    }

    func startPolling(interval: TimeInterval = 2.0) {
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
        logger.debug("refresh start")
        error = nil

        // Signal fetch first (needs re-auth check)
        var signalResult = await fetchSignal()

        // Session expired? Re-authenticate once and retry.
        if signalResult == nil, await authManager.reauthenticate() {
            signalResult = await fetchSignal()
        }

        // Parallelize remaining independent network calls
        async let batteryResult = fetchBattery()
        async let chargerResult = fetchCharger()
        async let chargeControlResult = fetchChargeControl()
        async let thermalResult = fetchThermal()
        async let trafficResult = fetchTraffic()
        async let deviceList = fetchDevices()
        async let wanResult = fetchWAN()
        async let wan6Result = fetchWAN6()
        async let wifiResult = fetchWifi()
        async let cpuResult = fetchSystemInfo()
        async let cpuUsage = fetchCpuUsage()
        async let battCurrentResult = fetchBatteryCurrent()
        async let simResult = fetchSimStatus()
        async let modemResult = fetchModemStatus()
        async let mobileDataResult = fetchMobileDataStatus()

        let (bat, charger, chargeCtrl, therm, traffic, devices, wan, wan6, wifi, cpu, cpuUse, battCurrent, sim, modemStatus, mobileDataOff) = await (
            batteryResult, chargerResult, chargeControlResult, thermalResult, trafficResult,
            deviceList, wanResult, wan6Result, wifiResult, cpuResult, cpuUsage,
            battCurrentResult, simResult, modemResult, mobileDataResult
        )

        if let (nr, lte, _, op) = signalResult {
            if nr != nrSignal { nrSignal = nr }
            if lte != lteSignal { lteSignal = lte }
            if op != operatorInfo { operatorInfo = op }
        }
        if let opMode = modemStatus {
            let airplane = !opMode.isEmpty && opMode != "ONLINE"
            if airplane != isAirplaneMode {
                withAnimation(.easeInOut) {
                    isAirplaneMode = airplane
                }
                if airplane {
                    nrSignal = .empty
                    lteSignal = .empty
                    operatorInfo = .empty
                }
            }
        }
        if var b = bat {
            if let chargerData = charger {
                DeviceParser.parseCharger(chargerData, into: &b, chargeControl: chargeCtrl)
            }
            b.currentMA = battCurrent.current
            b.voltageMV = battCurrent.voltage
            if b != battery { battery = b }
        }
        if let t = therm, t != thermal { thermal = t }
        if let traffic {
            if let prev = previousTraffic {
                let newSpeed = DeviceParser.computeSpeed(previous: prev, current: traffic)
                if newSpeed != speed { speed = newSpeed }
            }
            previousTraffic = traffic
            if traffic != trafficStats { trafficStats = traffic }
        }
        if let devices, devices != connectedDevices { connectedDevices = devices }
        let newIPv4 = wan ?? ""
        let newIPv6 = wan6 ?? ""
        if newIPv4 != wanIPv4 { wanIPv4 = newIPv4 }
        if newIPv6 != wanIPv6 { wanIPv6 = newIPv6 }
        if let wifi, wifi != wifiStatus { wifiStatus = wifi }
        if var cpu {
            if let usage = cpuUse {
                cpu.cpuUsagePercent = usage
                cpu.cpuUsageIsEstimate = false
            }
            if cpu != systemInfo { systemInfo = cpu }
        }
        if let (pin, puk) = sim {
            if pin != simPinRequired { withAnimation(.easeInOut) { simPinRequired = pin } }
            if puk != simPukRequired { withAnimation(.easeInOut) { simPukRequired = puk } }
        }
        if let dataOff = mobileDataOff, dataOff != isMobileDataOff {
            withAnimation(.easeInOut) { isMobileDataOff = dataOff }
        }

        lastUpdated = Date()
        logger.debug("refresh done")
    }

    private func fetchSignal() async -> (NRSignal, LTESignal, WCDMASignal, OperatorInfo)? {
        do {
            let data = try await client.getJSON("/api/network/signal")
            let parsed = SignalParser.parseNetInfo(data)
            return (parsed.0, parsed.1, parsed.2, parsed.3)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    private func fetchModemStatus() async -> String? {
        struct ModemStatusResponse: Decodable {
            let operate_mode: String
        }
        do {
            let resp: ModemStatusResponse = try await client.get("/api/modem/status")
            return resp.operate_mode
        } catch {
            return nil
        }
    }

    private func fetchBattery() async -> BatteryStatus? {
        do {
            let data = try await client.getJSON("/api/device/battery-info")
            return DeviceParser.parseBattery(data)
        } catch { return nil }
    }

    private func fetchCharger() async -> [String: Any]? {
        guard let data = try? await client.getJSON("/api/device/charger") else { return nil }
        return data
    }

    private func fetchChargeControl() async -> [String: Any]? {
        guard let data = try? await client.getJSON("/api/device/charge-control") else { return nil }
        return data
    }

    private func fetchThermal() async -> ThermalStatus? {
        do {
            let data = try await client.getJSON("/api/device/thermal")
            return DeviceParser.parseThermal(data)
        } catch { return nil }
    }

    private func fetchTraffic() async -> TrafficStats? {
        // Priority 1: server-computed speed (precise Instant timing on device)
        if let stats = await fetchAgentSpeed() {
            return stats
        }
        // Priority 2: native /api/network/traffic (kernel-level /proc/net/dev via agent)
        if let stats = await fetchAgentTraffic() {
            return stats
        }
        // Priority 3: zwrt_data get_wwandst (modem pre-computed rates)
        if let data = try? await client.getJSON("/api/network/speeds"),
           let stats = DeviceParser.parseWwandstTraffic(data) {
            return stats
        }
        // Priority 4: network.device status (rmnet_data0 delta)
        if let data = try? await client.getJSON("/api/network/rmnet") {
            var stats = DeviceParser.parseTraffic(data)
            stats.source = "rmnet_agent"
            return stats
        }
        return nil
    }

    private func fetchAgentSpeed() async -> TrafficStats? {
        struct AgentSpeedResponse: Decodable {
            let rx_bytes: UInt64
            let tx_bytes: UInt64
            let rx_speed: Double
            let tx_speed: Double
            let elapsed_ms: UInt64
        }
        do {
            let resp: AgentSpeedResponse = try await client.get("/api/network/speed")
            var stats = TrafficStats(
                rxBytes: resp.rx_bytes,
                txBytes: resp.tx_bytes,
                timestamp: Date(),
                source: "agent_speed"
            )
            stats.serverRxSpeed = resp.rx_speed
            stats.serverTxSpeed = resp.tx_speed
            return stats
        } catch {
            if Self.isCancellation(error) { return nil }
            return nil
        }
    }

    private func fetchAgentTraffic() async -> TrafficStats? {
        struct NetIface: Decodable {
            let name: String
            let rx_bytes: UInt64
            let tx_bytes: UInt64
        }
        do {
            let ifaces: [NetIface] = try await client.get("/api/network/traffic")
            guard let rmnet = ifaces.first(where: { $0.name == "rmnet_data0" }) else { return nil }
            return TrafficStats(rxBytes: rmnet.rx_bytes, txBytes: rmnet.tx_bytes, timestamp: Date(), source: "agent")
        } catch {
            if Self.isCancellation(error) { return nil }
            return nil
        }
    }

    private func fetchDevices() async -> [ConnectedDevice]? {
        do {
            let data = try await client.getJSON("/api/network/clients")
            let hostsData = data["hosts"] as? [String: Any] ?? [:]
            var deviceList = DeviceParser.parseHostHints(hostsData)
            if let leases = data["dhcp_leases"] as? [[String: Any]] {
                DeviceParser.enrichWithDHCP(devices: &deviceList, leases: leases)
            }
            return deviceList
        } catch { return nil }
    }

    private func fetchWAN() async -> String? {
        guard let data = try? await client.getJSON("/api/network/wan") else { return nil }
        let ip = DeviceParser.parseWanIPv4(data)
        return ip.isEmpty ? nil : ip
    }

    private func fetchWAN6() async -> String? {
        guard let data = try? await client.getJSON("/api/network/wan6") else { return nil }
        let ip = DeviceParser.parseWanIPv6(data)
        return ip.isEmpty ? nil : ip
    }

    private func fetchWifi() async -> WifiStatus? {
        if let data = try? await client.getJSON("/api/wifi/status"),
           data["htmode_2g"] != nil {
            return parseCompanionWifi(data)
        }
        return nil
    }

    private func parseCompanionWifi(_ data: [String: Any]) -> WifiStatus {
        let actualCh2g = data["actual_channel_2g"] as? String ?? ""
        let actualCh5g = data["actual_channel_5g"] as? String ?? ""
        let ch2g = !actualCh2g.isEmpty ? actualCh2g : (data["channel_2g"] as? String ?? "")
        let ch5g = !actualCh5g.isEmpty ? actualCh5g : (data["channel_5g"] as? String ?? "")
        let enc2g = data["encryption_2g"] as? String ?? ""
        let enc5g = data["encryption_5g"] as? String ?? ""
        let clientsTotal: Int
        if let n = data["clients_total"] as? Int {
            clientsTotal = n
        } else if let s = data["clients_total"] as? String, let n = Int(s) {
            clientsTotal = n
        } else {
            clientsTotal = 0
        }
        let guestDisabled2g = (data["guest_disabled_2g"] as? String) == "1"
        let guestDisabled5g = (data["guest_disabled_5g"] as? String) == "1"
        let guestEnabled = !guestDisabled2g || !guestDisabled5g
        return WifiStatus(
            wifiOn: (data["wifi_onoff"] as? String) == "1",
            ssid2g: data["ssid_2g"] as? String ?? "",
            ssid5g: data["ssid_5g"] as? String ?? "",
            channel2g: ch2g,
            channel5g: ch5g,
            radio2gDisabled: (data["radio2_disabled"] as? String) == "1",
            radio5gDisabled: (data["radio5_disabled"] as? String) == "1",
            encryption2g: DeviceParser.formatEncryption(enc2g),
            encryption5g: DeviceParser.formatEncryption(enc5g),
            hidden2g: (data["hidden_2g"] as? String) == "1",
            hidden5g: (data["hidden_5g"] as? String) == "1",
            txPower2g: data["txpower_2g"] as? String ?? "",
            txPower5g: data["txpower_5g"] as? String ?? "",
            bandwidth2g: data["htmode_2g"] as? String ?? "",
            bandwidth5g: data["htmode_5g"] as? String ?? "",
            clientsTotal: clientsTotal,
            wifi6: (data["wifi6_switch"] as? String) == "1",
            guestEnabled: guestEnabled,
            guestSsid: data["guest_ssid"] as? String ?? ""
        )
    }

    private func fetchSystemInfo() async -> SystemInfo? {
        guard let data = try? await client.getJSON("/api/device/system") else { return nil }
        return DeviceParser.parseSystemInfo(data, cpuCores: 4)
    }

    private func fetchBatteryCurrent() async -> (current: Int?, voltage: Int?) {
        struct BatteryInfo: Decodable {
            let current_ua: Int
            let voltage_uv: Int
        }
        do {
            let info: BatteryInfo = try await client.get("/api/battery")
            return (info.current_ua / 1000, info.voltage_uv / 1000)
        } catch {
            if Self.isCancellation(error) { return (nil, nil) }
            return (nil, nil)
        }
    }

    private func fetchCpuUsage() async -> Double? {
        struct CpuUsage: Decodable {
            let cores: [Double]
            let overall: Double
        }
        do {
            let usage: CpuUsage = try await client.get("/api/cpu")
            return usage.overall
        } catch {
            if Self.isCancellation(error) { return nil }
            return nil
        }
    }

    private func fetchMobileDataStatus() async -> Bool? {
        guard let data = try? await client.getJSON("/api/modem/data") else { return nil }
        let wwan = MobileNetworkParser.parseWWAN(data)
        let connected = wwan.connectStatus.contains("connected")
        return wwan.dataEnabled == 0 && !connected
    }

    private func fetchSimStatus() async -> (pin: Bool, puk: Bool)? {
        do {
            let data = try await client.getJSON("/api/sim/info")
            let sim = (data["sim_states"] as? String ?? "").lowercased()
            let modem = (data["modem_main_state"] as? String ?? "").lowercased()
            return (
                sim == "wait pin" || modem == "modem_waitpin",
                sim == "wait puk" || modem == "modem_waitpuk"
            )
        } catch {
            if Self.isCancellation(error) { return nil }
            return nil
        }
    }
}
