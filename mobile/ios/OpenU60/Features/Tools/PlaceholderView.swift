import SwiftUI

struct PlaceholderView: View {
    let title: String
    let icon: String
    let description: String

    init(title: String, icon: String = "usb", description: String = "Requires ADB USB connection") {
        self.title = title
        self.icon = icon
        self.description = description
    }

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)
            Text(title)
                .font(.title2.bold())
            Text(description)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationTitle(title)
    }
}
