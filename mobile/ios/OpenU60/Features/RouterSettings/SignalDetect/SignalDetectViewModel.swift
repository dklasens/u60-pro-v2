import SwiftUI

@Observable
@MainActor
final class SignalDetectViewModel {
    var status: SignalDetectStatus = .empty
    var isLoading: Bool = false
    var message: String?
    var messageIsError: Bool = false

    private let client: AgentClient
    private let authManager: AuthManager
    private var pollTask: Task<Void, Never>?

    init(client: AgentClient, authManager: AuthManager) {
        self.client = client
        self.authManager = authManager
    }

    func startDetection() async {
        isLoading = true
        message = nil
        status.results = []

        do {
            let _ = try await client.postJSON("/api/cell/signal-detect/start")
            status.running = true
            showMessage("Detection started", isError: false)
            startPolling()
        } catch {
            showMessage("Failed to start: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func stopDetection() async {
        stopPolling()

        do {
            let _ = try await client.postJSON("/api/cell/signal-detect/stop")
            status.running = false
            showMessage("Detection stopped", isError: false)
            await fetchResults()
        } catch {
            showMessage("Failed to stop: \(error.localizedDescription)", isError: true)
        }
    }

    func fetchResults() async {
        do {
            let data = try await client.getJSON("/api/cell/signal-detect/results")
            status.results = SignalDetectParser.parseResults(data)
        } catch {
            // Results may not be available yet
        }
    }

    private func startPolling() {
        stopPolling()
        pollTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2))
                await pollProgress()
                if !status.running { break }
            }
        }
    }

    private func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    private func pollProgress() async {
        do {
            let data = try await client.getJSON("/api/cell/signal-detect/progress")
            let progressStatus = SignalDetectParser.parseProgress(data)
            status.progress = progressStatus.progress
            if progressStatus.progress >= 100 {
                status.running = false
                stopPolling()
                await fetchResults()
                showMessage("Detection complete", isError: false)
            }
        } catch {
            // Continue polling
        }
    }

    private func showMessage(_ text: String, isError: Bool) {
        message = text
        messageIsError = isError
    }
}
