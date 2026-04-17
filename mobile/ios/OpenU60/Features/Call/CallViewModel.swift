import SwiftUI
import os

private let logger = Logger(subsystem: "com.zte.companion", category: "Call")

enum CallState: Equatable {
    case idle
    case dialing
    case alerting
    case active
    case incoming(from: String)
}

@Observable
@MainActor
final class CallViewModel {
    var phoneNumber: String = ""
    var callState: CallState = .idle
    var isMuted: Bool = false
    var callDuration: TimeInterval = 0
    var error: String?
    var showKeypad: Bool = false

    private let client: AgentClient
    private let authManager: AuthManager
    private var pollTask: Task<Void, Never>?
    private var durationTask: Task<Void, Never>?
    private var callStartTime: Date?

    init(client: AgentClient, authManager: AuthManager) {
        self.client = client
        self.authManager = authManager
    }

    // MARK: - Number Input

    func appendDigit(_ digit: String) {
        phoneNumber.append(digit)
        if callState == .active {
            Task { await sendDTMF(digit) }
        }
    }

    func deleteDigit() {
        guard !phoneNumber.isEmpty else { return }
        phoneNumber.removeLast()
    }

    // MARK: - Call Actions

    func dial() async {
        let number = phoneNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !number.isEmpty else { return }
        error = nil
        callState = .dialing

        do {
            let _ = try await client.postJSON("/api/call/dial", body: ["number": number])
        } catch {
            self.error = error.localizedDescription
            callState = .idle
        }
        // State will be updated by polling
        startPolling()
    }

    func hangup() async {
        error = nil
        let _ = try? await client.postJSON("/api/call/hangup")
        callState = .idle
        isMuted = false
        stopDurationTimer()
        stopPolling()
    }

    func answer() async {
        error = nil
        let _ = try? await client.postJSON("/api/call/answer")
        startPolling()
    }

    func sendDTMF(_ digits: String) async {
        let _ = try? await client.postJSON("/api/call/dtmf", body: ["digits": digits])
    }

    func toggleMute() async {
        let newMuted = !isMuted
        do {
            let result = try await client.postJSON("/api/call/mute", body: ["enabled": newMuted])
            if let muted = result["muted"] as? Bool {
                isMuted = muted
            } else {
                isMuted = newMuted
            }
        } catch {
            // keep current state
        }
    }

    // MARK: - Polling

    func startPolling() {
        stopPolling()
        pollTask = Task {
            while !Task.isCancelled {
                await pollCallStatus()
                try? await Task.sleep(for: .seconds(2))
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    private func pollCallStatus() async {
        guard let result = try? await client.getJSON("/api/call/status") else { return }
        guard let calls = result["calls"] as? [[String: Any]] else { return }

        if calls.isEmpty {
            if callState != .idle {
                callState = .idle
                isMuted = false
                stopDurationTimer()
            }
            return
        }

        guard let first = calls.first,
              let stat = first["stat"] as? String else { return }

        let number = first["number"] as? String ?? ""
        let dir = first["dir"] as? String ?? "mo"

        switch stat {
        case "dialing":
            callState = .dialing
        case "alerting":
            callState = .alerting
        case "active":
            if callState != .active {
                callState = .active
                startDurationTimer()
            }
        case "incoming", "waiting":
            callState = .incoming(from: number.isEmpty ? (dir == "mt" ? "Unknown" : number) : number)
        case "held":
            break // keep current state
        case "releasing":
            callState = .idle
            isMuted = false
            stopDurationTimer()
        default:
            break
        }
    }

    // MARK: - Duration Timer

    private func startDurationTimer() {
        callStartTime = Date()
        callDuration = 0
        stopDurationTimer()
        durationTask = Task {
            while !Task.isCancelled {
                if let start = callStartTime {
                    callDuration = Date().timeIntervalSince(start)
                }
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }

    private func stopDurationTimer() {
        durationTask?.cancel()
        durationTask = nil
        callStartTime = nil
        callDuration = 0
    }
}
