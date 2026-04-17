import SwiftUI

struct ProcessListSheet: View {
    let client: AgentClient

    @State private var processes: [ProcessInfo] = []
    @State private var bloatCount = 0
    @State private var bloatCpuPct = 0.0
    @State private var bloatRssKb = 0
    @State private var isLoading = false
    @State private var error: String?
    @State private var banner: String?
    @State private var showKillAllConfirm = false
    @State private var refreshTimer: Timer?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && processes.isEmpty {
                    ProgressView("Loading processes...")
                } else {
                    List {
                        if bloatCount > 0 {
                            Section {
                                HStack {
                                    Label("Bloat Daemons", systemImage: "exclamationmark.triangle")
                                        .foregroundStyle(.orange)
                                    Spacer()
                                    VStack(alignment: .trailing) {
                                        Text("\(bloatCount) processes")
                                            .font(.caption)
                                        Text(String(format: "%.1f%% CPU, %@ RSS", bloatCpuPct, formatKB(bloatRssKb)))
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }

                        if let error {
                            Section {
                                Text(error)
                                    .foregroundStyle(.red)
                                    .font(.caption)
                            }
                        }

                        if let banner {
                            Section {
                                Text(banner)
                                    .foregroundStyle(.green)
                                    .font(.caption)
                            }
                        }

                        Section(header: Text("Top Processes")) {
                            ForEach(processes) { proc in
                                processRow(proc)
                                    .swipeActions(edge: .trailing) {
                                        if proc.isBloat {
                                            Button(role: .destructive) {
                                                Task { await killSingle(proc.pid) }
                                            } label: {
                                                Label("Kill", systemImage: "xmark.circle")
                                            }
                                        }
                                    }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Processes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                }
                if bloatCount > 0 {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Kill All Bloat", role: .destructive) {
                            showKillAllConfirm = true
                        }
                        .foregroundStyle(.red)
                    }
                }
            }
            .confirmationDialog("Kill all bloat daemons?", isPresented: $showKillAllConfirm, titleVisibility: .visible) {
                Button("Kill All Bloat", role: .destructive) {
                    Task { await killAll() }
                }
            } message: {
                Text("This will SIGKILL \(bloatCount) bloat daemons. They will return on reboot.")
            }
            .task {
                await refresh()
                startTimer()
            }
            .onDisappear {
                refreshTimer?.invalidate()
            }
        }
    }

    @ViewBuilder
    private func processRow(_ proc: ProcessInfo) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(proc.name)
                    .font(.body)
                    .foregroundStyle(proc.isBloat ? .orange : .primary)
                Text("PID \(proc.pid) \u{00B7} \(proc.state)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "%.1f%%", proc.cpuPct))
                    .font(.body.monospacedDigit())
                    .foregroundStyle(proc.cpuPct > 10 ? .red : (proc.cpuPct > 2 ? .orange : .secondary))
                Text(formatKB(proc.rssKb))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func refresh() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let result: ProcessListResponse = try await client.get("/api/system/top")
            processes = result.processes
            bloatCount = result.bloatCount
            bloatCpuPct = result.bloatCpuPct
            bloatRssKb = result.bloatRssKb
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func killSingle(_ pid: Int) async {
        do {
            let body = ["pids": [pid]] as [String: Any]
            let data = try await client.postJSON("/api/system/kill-bloat", body: body)
            let freed = data["freed_rss_kb"] as? Int ?? 0
            banner = "Killed PID \(pid), freed \(formatKB(freed))"
            await refresh()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func killAll() async {
        do {
            let data = try await client.postJSON("/api/system/kill-bloat", body: ["all": true])
            let freed = data["freed_rss_kb"] as? Int ?? 0
            let killedArr = data["killed"] as? [[String: Any]] ?? []
            banner = "Killed \(killedArr.count) daemons, freed \(formatKB(freed))"
            await refresh()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func startTimer() {
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { _ in
            Task { @MainActor in
                await refresh()
            }
        }
    }

    private func formatKB(_ kb: Int) -> String {
        if kb >= 1024 {
            return String(format: "%.1f MB", Double(kb) / 1024.0)
        }
        return "\(kb) KB"
    }
}
