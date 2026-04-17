import Foundation

@Observable
@MainActor
final class LANSpeedTestViewModel {
    var phase: String = "idle"
    var pingMs: Double?
    var downloadMbps: Double?
    var uploadMbps: Double?
    var liveSpeedMbps: Double = 0
    var progress: Double = 0
    var isRunning: Bool = false
    var error: String?

    private let client: AgentClient
    private nonisolated(unsafe) var testTask: Task<Void, Never>?

    private let testSize = 20_000_000

    init(client: AgentClient) {
        self.client = client
    }

    deinit {
        testTask?.cancel()
    }

    func startTest() {
        guard !isRunning else { return }
        isRunning = true
        phase = "idle"
        pingMs = nil
        downloadMbps = nil
        uploadMbps = nil
        liveSpeedMbps = 0
        progress = 0
        error = nil

        testTask = Task {
            do {
                try Task.checkCancellation()
                phase = "ping"
                pingMs = try await measurePing()
                progress = 0.2

                try Task.checkCancellation()
                phase = "download"
                liveSpeedMbps = 0
                downloadMbps = try await measureDownload()
                progress = 0.6

                try Task.checkCancellation()
                phase = "upload"
                liveSpeedMbps = 0
                uploadMbps = try await measureUpload()
                progress = 1.0

                phase = "complete"
            } catch is CancellationError {
                phase = "cancelled"
            } catch {
                self.error = error.localizedDescription
                phase = "error"
            }
            liveSpeedMbps = 0
            isRunning = false
        }
    }

    func stopTest() {
        testTask?.cancel()
        testTask = nil
    }

    // MARK: - Ping

    private func measurePing() async throws -> Double {
        let baseURL = client.baseURL
        let token = client.token
        guard let url = URL(string: "\(baseURL)/api/lan/ping") else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 5
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }

        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 5
        let session = URLSession(configuration: config)
        defer { session.invalidateAndCancel() }

        var rtts: [Double] = []
        for _ in 0..<10 {
            try Task.checkCancellation()
            let start = CFAbsoluteTimeGetCurrent()
            let (_, _) = try await session.data(for: request)
            let rtt = (CFAbsoluteTimeGetCurrent() - start) * 1000
            rtts.append(rtt)
        }

        guard !rtts.isEmpty else { throw URLError(.cannotConnectToHost) }
        rtts.sort()
        return rtts[rtts.count / 2]
    }

    // MARK: - Download

    private func measureDownload() async throws -> Double {
        let baseURL = client.baseURL
        let token = client.token
        let size = testSize
        guard let url = URL(string: "\(baseURL)/api/lan/download?size=\(size)") else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 120
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }

        let measurer = DownloadMeasurer(expectedSize: Int64(size)) { [weak self] mbps, fraction in
            Task { @MainActor [weak self] in
                self?.liveSpeedMbps = mbps
                self?.progress = 0.2 + fraction * 0.4
            }
        }

        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 120
        config.timeoutIntervalForResource = 120
        let session = URLSession(configuration: config, delegate: measurer, delegateQueue: nil)
        defer { session.invalidateAndCancel() }

        let (_, _) = try await session.data(for: request, delegate: measurer)
        return measurer.finalMbps
    }

    // MARK: - Upload

    private func measureUpload() async throws -> Double {
        let baseURL = client.baseURL
        let token = client.token
        let size = testSize
        guard let url = URL(string: "\(baseURL)/api/lan/upload") else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 120
        request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        request.httpBody = Data(count: size)

        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 120
        config.timeoutIntervalForResource = 120
        let session = URLSession(configuration: config)
        defer { session.invalidateAndCancel() }

        let start = CFAbsoluteTimeGetCurrent()
        let (data, _) = try await session.data(for: request)
        let clientElapsed = CFAbsoluteTimeGetCurrent() - start

        // Parse server-measured result (primary)
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let inner = json["data"] as? [String: Any],
           let serverMbps = inner["mbps"] as? Double {
            return serverMbps
        }

        // Fallback to client-side calculation
        return clientElapsed > 0 ? Double(size) * 8.0 / (clientElapsed * 1_000_000) : 0
    }
}

// MARK: - Download delegate

private final class DownloadMeasurer: NSObject, URLSessionDataDelegate, @unchecked Sendable {
    private let startTime = CFAbsoluteTimeGetCurrent()
    private var totalReceived: Int64 = 0
    private let expectedSize: Int64
    private let onProgress: @Sendable (Double, Double) -> Void

    var finalMbps: Double {
        let elapsed = CFAbsoluteTimeGetCurrent() - startTime
        return elapsed > 0 ? Double(totalReceived) * 8.0 / (elapsed * 1_000_000) : 0
    }

    init(expectedSize: Int64, onProgress: @escaping @Sendable (Double, Double) -> Void) {
        self.expectedSize = expectedSize
        self.onProgress = onProgress
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        totalReceived += Int64(data.count)
        let elapsed = CFAbsoluteTimeGetCurrent() - startTime
        guard elapsed > 0.1 else { return }
        let mbps = Double(totalReceived) * 8.0 / (elapsed * 1_000_000)
        let fraction = min(Double(totalReceived) / Double(expectedSize), 1.0)
        onProgress(mbps, fraction)
    }
}

