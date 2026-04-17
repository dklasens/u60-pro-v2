import SwiftUI

struct SpeedTestServer: Identifiable {
    let id: Int
    let name: String
    let country: String
    let sponsor: String
}

struct SpeedTestProgress {
    var phase: String = "idle"
    var progress: Int = 0
    var liveSpeedMbps: Double = 0
    var pingMs: Double?
    var jitterMs: Double?
    var downloadMbps: Double?
    var uploadMbps: Double?
    var downloadBytes: Int = 0
    var uploadBytes: Int = 0
    var server: String = ""
    var error: String?
}

@Observable
@MainActor
final class SpeedTestViewModel {
    var servers: [SpeedTestServer] = []
    var selectedServerId: Int?
    var progress: SpeedTestProgress = SpeedTestProgress()
    var isRunning: Bool = false
    var isLoading: Bool = false
    var message: String?
    var messageIsError: Bool = false

    private let client: AgentClient
    private let authManager: AuthManager
    private nonisolated(unsafe) var pollTask: Task<Void, Never>?
    private var pollFailures = 0
    private let maxPollFailures = 10

    init(client: AgentClient, authManager: AuthManager) {
        self.client = client
        self.authManager = authManager
    }

    deinit {
        pollTask?.cancel()
    }

    func loadServers() async {
        isLoading = true
        do {
            let items = try await client.getJSONArray("/api/speedtest/servers")
            servers = items.compactMap { dict -> SpeedTestServer? in
                guard let id = (dict["id"] as? Int) ?? (dict["id"] as? String).flatMap({ Int($0) }),
                      let name = dict["name"] as? String,
                      let country = dict["country"] as? String,
                      let sponsor = dict["sponsor"] as? String else { return nil }
                return SpeedTestServer(id: id, name: name, country: country, sponsor: sponsor)
            }
            if selectedServerId == nil, let first = servers.first {
                selectedServerId = first.id
            }
        } catch {
            showMessage("Failed to load servers: \(error.localizedDescription)", isError: true)
        }
        isLoading = false
    }

    func startTest() async {
        guard let serverId = selectedServerId else {
            showMessage("Select a server first", isError: true)
            return
        }

        isLoading = true
        message = nil
        progress = SpeedTestProgress()

        do {
            let _ = try await client.postJSON("/api/speedtest/start", body: ["server_id": serverId])
            isRunning = true
            showMessage("Speed test started", isError: false)
            startPolling()
        } catch {
            showMessage("Failed to start: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func stopTest() async {
        stopPolling()
        isRunning = false

        do {
            let _ = try await client.postJSON("/api/speedtest/stop")
            showMessage("Speed test stopped", isError: false)
        } catch {
            showMessage("Failed to stop: \(error.localizedDescription)", isError: true)
        }
    }

    private func startPolling() {
        stopPolling()
        pollFailures = 0
        pollTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                await pollProgress()
                if !isRunning { break }
            }
        }
    }

    private func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    private func pollProgress() async {
        do {
            let data = try await client.getJSON("/api/speedtest/progress")
            pollFailures = 0

            progress.phase = data["phase"] as? String ?? progress.phase
            progress.progress = data["progress"] as? Int ?? progress.progress
            progress.liveSpeedMbps = data["live_speed_mbps"] as? Double ?? progress.liveSpeedMbps
            progress.pingMs = data["ping_ms"] as? Double
            progress.jitterMs = data["jitter_ms"] as? Double
            progress.downloadMbps = data["download_mbps"] as? Double
            progress.uploadMbps = data["upload_mbps"] as? Double
            progress.downloadBytes = data["download_bytes"] as? Int ?? progress.downloadBytes
            progress.uploadBytes = data["upload_bytes"] as? Int ?? progress.uploadBytes
            progress.server = data["server"] as? String ?? progress.server
            progress.error = data["error"] as? String

            if progress.phase == "complete" {
                isRunning = false
                stopPolling()
                showMessage("Speed test complete", isError: false)
            } else if progress.phase == "error" {
                isRunning = false
                stopPolling()
                showMessage(progress.error ?? "Speed test failed", isError: true)
            } else if progress.phase == "cancelled" {
                isRunning = false
                stopPolling()
                showMessage("Speed test cancelled", isError: false)
            }
        } catch {
            pollFailures += 1
            if pollFailures >= maxPollFailures {
                isRunning = false
                stopPolling()
                showMessage("Lost connection to device", isError: true)
            }
        }
    }

    private func showMessage(_ text: String, isError: Bool) {
        message = text
        messageIsError = isError
    }
}
