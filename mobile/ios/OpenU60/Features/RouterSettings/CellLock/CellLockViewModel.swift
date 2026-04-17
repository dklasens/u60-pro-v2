import SwiftUI

@Observable
@MainActor
final class CellLockViewModel {
    var status: CellLockStatus = .empty
    var neighbors: [NeighborCell] = []
    var isLoading: Bool = false
    var isScanning: Bool = false
    var message: String?
    var messageIsError: Bool = false

    // NR lock fields
    var nrPCI: String = ""
    var nrEARFCN: String = ""
    var nrBand: String = ""

    // LTE lock fields
    var ltePCI: String = ""
    var lteEARFCN: String = ""

    private let client: AgentClient
    private let authManager: AuthManager

    init(client: AgentClient, authManager: AuthManager) {
        self.client = client
        self.authManager = authManager
    }

    func refresh() async {
        isLoading = true
        message = nil

        do {
            let data = try await client.getJSON("/api/network/signal")
            status = CellLockParser.parse(data)
        } catch {
            showMessage("Failed to load cell info: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func lockNR() async {
        guard !nrPCI.isEmpty, !nrEARFCN.isEmpty else {
            showMessage("PCI and EARFCN are required", isError: true)
            return
        }

        isLoading = true

        do {
            var params: [String: Any] = ["pci": nrPCI, "earfcn": nrEARFCN]
            if !nrBand.isEmpty { params["band"] = nrBand }

            let _ = try await client.postJSON("/api/cell/lock/nr", body: params)
            showMessage("NR cell locked", isError: false)
            status.locked = true
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func lockLTE() async {
        guard !ltePCI.isEmpty, !lteEARFCN.isEmpty else {
            showMessage("PCI and EARFCN are required", isError: true)
            return
        }

        isLoading = true

        do {
            let _ = try await client.postJSON("/api/cell/lock/lte", body: ["pci": ltePCI, "earfcn": lteEARFCN])
            showMessage("LTE cell locked", isError: false)
            status.locked = true
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func scanNeighbors() async {
        isScanning = true
        neighbors = []

        do {
            let _ = try await client.postJSON("/api/cell/neighbors/scan")

            // Poll for results
            try await Task.sleep(for: .seconds(3))

            // Fetch NR neighbors
            if let nrData = try? await client.getJSON("/api/cell/neighbors/nr") {
                neighbors += CellLockParser.parseNeighbors(nrData, type: "NR")
            }

            // Fetch LTE neighbors
            if let lteData = try? await client.getJSON("/api/cell/neighbors/lte") {
                neighbors += CellLockParser.parseNeighbors(lteData, type: "LTE")
            }

            if neighbors.isEmpty {
                showMessage("No neighbors found", isError: false)
            } else {
                showMessage("Found \(neighbors.count) neighbor cell(s)", isError: false)
            }
        } catch {
            showMessage("Scan failed: \(error.localizedDescription)", isError: true)
        }

        isScanning = false
    }

    func unlock() async {
        isLoading = true

        do {
            let _ = try await client.postJSON("/api/cell/lock/reset")
            showMessage("Cell lock reset", isError: false)
            status.locked = false
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
