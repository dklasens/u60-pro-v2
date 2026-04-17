import SwiftUI
import os

private let logger = Logger(subsystem: "com.zte.companion", category: "Signal")

@Observable
@MainActor
final class SignalMonitorViewModel {
    var nrSignal: NRSignal = .empty
    var lteSignal: LTESignal = .empty
    var wcdmaSignal: WCDMASignal = .empty
    var operatorInfo: OperatorInfo = .empty
    var history: [SignalSnapshot] = []
    var isLoading: Bool = false
    var lastUpdated: Date?
    var error: String?

    private let client: AgentClient
    private let authManager: AuthManager
    private var pollTask: Task<Void, Never>?
    private let maxHistoryPoints = 60

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

        do {
            let data = try await client.getJSON("/api/network/signal")
            let (nr, lte, wcdma, op) = SignalParser.parseNetInfo(data)
            if nr != nrSignal { nrSignal = nr }
            if lte != lteSignal { lteSignal = lte }
            if wcdma != wcdmaSignal { wcdmaSignal = wcdma }
            if op != operatorInfo { operatorInfo = op }

            let snapshot = SignalSnapshot(
                timestamp: Date(),
                nrRSRP: nr.rsrp,
                lteRSRP: lte.rsrp
            )
            history.append(snapshot)
            if history.count > maxHistoryPoints {
                history.removeFirst(history.count - maxHistoryPoints)
            }
        } catch {
            self.error = error.localizedDescription
        }

        lastUpdated = Date()
        logger.debug("refresh done")
    }
}
