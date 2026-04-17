import SwiftUI

struct SMSForwardLogView: View {
    @Bindable var viewModel: SMSForwardViewModel

    var body: some View {
        List(viewModel.log) { entry in
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(entry.sender)
                        .font(.headline)
                    Spacer()
                    Image(systemName: entry.success ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundStyle(entry.success ? .green : .red)
                }
                Text("\(entry.ruleName) → \(entry.destinationType)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(entry.contentPreview)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if let error = entry.error {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
                Text(formatTimestamp(entry.timestamp))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .padding(.vertical, 2)
        }
        .navigationTitle("Forward Log")
        .toolbar {
            Button("Clear") {
                Task { await viewModel.clearLog() }
            }
        }
        .overlay {
            if viewModel.log.isEmpty && !viewModel.isLoading {
                ContentUnavailableView("No Log Entries", systemImage: "doc.text",
                                       description: Text("Forwarded messages will appear here"))
            }
        }
        .task { await viewModel.fetchLog() }
    }

    private func formatTimestamp(_ ts: Int) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(ts))
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .medium
        return formatter.string(from: date)
    }
}
