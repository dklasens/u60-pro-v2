import SwiftUI

@Observable
@MainActor
final class DeviceInfoViewModel {
    var identity: DeviceIdentity = .empty
    var operatorInfo: OperatorInfo = .empty
    var isLoading: Bool = false
    var error: String?

    private let client: AgentClient
    private let authManager: AuthManager

    init(client: AgentClient, authManager: AuthManager) {
        self.client = client
        self.authManager = authManager
    }

    func refresh() async {
        isLoading = true
        error = nil

        async let simTask = fetchSIMInfo()
        async let imeiTask = fetchIMEI()
        async let wanTask = fetchWANStatus()
        async let wan6Task = fetchWAN6Status()
        async let lanTask = fetchLANStatus()
        async let signalTask = fetchSignalInfo()

        let (simInfo, imeiData, wanStatus, wan6Status, lanStatus, signalInfo) =
            await (simTask, imeiTask, wanTask, wan6Task, lanTask, signalTask)

        identity = DeviceParser.parseIdentity(
            simInfo: simInfo ?? [:],
            imeiData: imeiData ?? [:],
            wanStatus: wanStatus ?? [:],
            wan6Status: wan6Status ?? [:],
            lanStatus: lanStatus ?? [:]
        )
        if let signalInfo {
            operatorInfo = signalInfo
        }
        isLoading = false
    }

    private func fetchSIMInfo() async -> [String: Any]? {
        do {
            return try await client.getJSON("/api/sim/info")
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    private func fetchIMEI() async -> [String: Any]? {
        try? await client.getJSON("/api/sim/imei")
    }

    private func fetchWANStatus() async -> [String: Any]? {
        try? await client.getJSON("/api/network/wan")
    }

    private func fetchWAN6Status() async -> [String: Any]? {
        try? await client.getJSON("/api/network/wan6")
    }

    private func fetchLANStatus() async -> [String: Any]? {
        try? await client.getJSON("/api/network/lan-status")
    }

    private func fetchSignalInfo() async -> OperatorInfo? {
        do {
            let data = try await client.getJSON("/api/network/signal")
            let (_, _, _, opInfo) = SignalParser.parseNetInfo(data)
            return opInfo
        } catch { return nil }
    }
}
