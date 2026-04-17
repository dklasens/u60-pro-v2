import SwiftUI

struct NetworkTypeIcon: View {
    let networkType: String

    var body: some View {
        if isNoService {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 28)
                .background(pillColor, in: Capsule())
        } else if isTwoLine {
            VStack(spacing: 0) {
                Text(generation)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                Text(subtitle)
                    .font(.system(size: 9, weight: .semibold, design: .rounded))
            }
            .foregroundStyle(.white)
            .frame(width: 44, height: 32)
            .background(pillColor, in: Capsule())
        } else {
            Text(label)
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .frame(width: 44, height: 28)
                .background(pillColor, in: Capsule())
        }
    }

    private var isNoService: Bool {
        let raw = networkType.lowercased()
        return raw.contains("limited") || raw.contains("no service")
    }

    private var isTwoLine: Bool {
        networkType == "5G SA" || networkType == "5G NSA"
    }

    private var generation: String {
        switch networkType {
        case "5G SA", "5G NSA": return "5G"
        default: return networkType
        }
    }

    private var subtitle: String {
        switch networkType {
        case "5G SA": return "SA"
        case "5G NSA": return "NSA"
        default: return ""
        }
    }

    private var label: String {
        networkType.isEmpty ? "--" : networkType
    }

    private var pillColor: Color {
        switch networkType {
        case "5G SA": return .blue
        case "5G NSA": return .teal
        case "4G+", "4G": return .green
        default:
            if isNoService { return .orange }
            if networkType.contains("3G") || networkType.contains("WCDMA")
                || networkType.contains("UMTS") || networkType.contains("GSM")
                || networkType.contains("2G") {
                return .orange
            }
            return .gray
        }
    }
}
