import SwiftUI

struct LastUpdatedView: View {
    let date: Date?

    @State private var elapsed: Int = 0

    private var text: String {
        guard date != nil else { return "--" }
        if elapsed < 60 {
            return "\(elapsed)s ago"
        }
        return "\(elapsed / 60)m \(elapsed % 60)s ago"
    }

    var body: some View {
        Text(text)
            .font(.caption2.monospacedDigit())
            .foregroundStyle(.secondary)
            .contentTransition(.numericText())
            .animation(.default, value: elapsed)
            .onReceive(Timer.publish(every: 1, on: .main, in: .default).autoconnect()) { _ in
                updateElapsed()
            }
            .onChange(of: date) {
                updateElapsed()
            }
    }

    private func updateElapsed() {
        guard let date else {
            elapsed = 0
            return
        }
        elapsed = max(0, Int(Date().timeIntervalSince(date)))
    }
}
