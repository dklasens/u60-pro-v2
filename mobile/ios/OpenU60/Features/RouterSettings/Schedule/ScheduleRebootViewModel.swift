import SwiftUI

@Observable
@MainActor
final class ScheduleRebootViewModel {
    var config: ScheduleRebootConfig = .empty
    var isLoading: Bool = false
    var message: String?
    var messageIsError: Bool = false

    var editEnabled: Bool = false
    var editTime: Date = Calendar.current.date(from: DateComponents(hour: 3, minute: 0)) ?? Date()
    var editDays: Set<String> = []

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
            let data = try await client.getJSON("/api/modem/schedule-reboot")
            config = ScheduleRebootParser.parse(data)
            editEnabled = config.enabled
            editTime = parseTime(config.time)
            editDays = Set(config.days.split(separator: ",").map(String.init))
        } catch {
            showMessage("Failed to load schedule: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func apply() async {
        isLoading = true

        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        let timeStr = formatter.string(from: editTime)
        let daysStr = editDays.sorted().joined(separator: ",")

        do {
            let _ = try await client.putJSON("/api/modem/schedule-reboot", body: [
                "auto_reboot_enable": editEnabled ? "1" : "0",
                "auto_reboot_time": timeStr,
                "auto_reboot_days": daysStr
            ])
            showMessage("Schedule updated", isError: false)
            config = ScheduleRebootConfig(enabled: editEnabled, time: timeStr, days: daysStr)
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    private func parseTime(_ timeStr: String) -> Date {
        let parts = timeStr.split(separator: ":")
        guard parts.count == 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]) else {
            return Calendar.current.date(from: DateComponents(hour: 3, minute: 0)) ?? Date()
        }
        return Calendar.current.date(from: DateComponents(hour: hour, minute: minute)) ?? Date()
    }

    private func showMessage(_ text: String, isError: Bool) {
        message = text
        messageIsError = isError
    }
}
