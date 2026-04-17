import SwiftUI

struct DoHCacheInspectorView: View {
    let entries: [DoHCacheEntry]
    let onRefresh: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""
    @State private var visibleCount = 50

    private var filtered: [DoHCacheEntry] {
        let sorted = entries.sorted { $0.ttl > $1.ttl }
        if searchText.isEmpty { return sorted }
        return sorted.filter { $0.domain.localizedCaseInsensitiveContains(searchText) }
    }

    private var visible: [DoHCacheEntry] {
        Array(filtered.prefix(visibleCount))
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(visible) { entry in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.domain)
                                .font(.system(.subheadline, design: .monospaced))
                                .lineLimit(1)
                            Text(formatTTL(entry.ttl))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(entry.type_)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(typeBadgeColor(entry.type_).opacity(0.15))
                            .foregroundStyle(typeBadgeColor(entry.type_))
                            .clipShape(Capsule())
                    }
                }

                if visible.count < filtered.count {
                    Button("Load More") {
                        visibleCount += 50
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .searchable(text: $searchText, prompt: "Filter by domain")
            .navigationTitle("DNS Cache (\(filtered.count))")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .refreshable { onRefresh() }
        }
    }

    private func formatTTL(_ seconds: Int) -> String {
        if seconds >= 3600 {
            let h = seconds / 3600
            let m = (seconds % 3600) / 60
            return "\(h)h \(m)m"
        } else if seconds >= 60 {
            let m = seconds / 60
            let s = seconds % 60
            return "\(m)m \(s)s"
        }
        return "\(seconds)s"
    }

    private func typeBadgeColor(_ type: String) -> Color {
        switch type {
        case "A": .blue
        case "AAAA": .purple
        case "CNAME": .orange
        case "HTTPS": .green
        case "MX": .red
        case "TXT": .brown
        default: .gray
        }
    }
}
