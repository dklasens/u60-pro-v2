import SwiftUI

// MARK: - DigitElement

struct DigitElement: Identifiable, Equatable {
    let id: Int          // Stable column index (right-to-left)
    let value: String    // "0"-"9" or separator
    let isDigit: Bool
    var digitValue: Int? { isDigit ? Int(value) : nil }
}

// MARK: - AnimatedNumber

/// Displays an integer or double with per-digit odometer-reel animations.
/// Uses right-to-left stable IDs based on place value so that digit count changes
/// (e.g., 999 -> 1,000) animate correctly without layout glitches.
struct AnimatedNumber: View {
    private enum Value: Equatable {
        case integer(Int, separator: String?)
        case decimal(Double, decimalPlaces: Int)
    }

    private let value: Value
    private let isNegative: Bool
    var font: Font = .system(size: 32, weight: .bold, design: .rounded)
    var textColor: Color = .primary
    var animationDuration: Double = 0.4
    var prefix: String?
    var suffix: String?

    @State private var isAnimated = false

    private static let formatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = Locale(identifier: "en_US")
        return f
    }()

    /// Integer initializer (existing behavior).
    init(
        value: Int,
        font: Font = .system(size: 32, weight: .bold, design: .rounded),
        textColor: Color = .primary,
        animationDuration: Double = 0.4,
        prefix: String? = nil,
        suffix: String? = nil,
        separator: String? = nil
    ) {
        self.isNegative = value < 0
        self.font = font
        self.textColor = textColor
        self.animationDuration = animationDuration
        self.prefix = prefix
        self.suffix = suffix
        self.value = .integer(abs(value), separator: separator)
    }

    /// Double initializer for percentage-style animated values.
    init(
        value: Double,
        decimalPlaces: Int = 1,
        font: Font = .system(size: 32, weight: .bold, design: .rounded),
        textColor: Color = .primary,
        animationDuration: Double = 0.4,
        prefix: String? = nil,
        suffix: String? = nil
    ) {
        self.isNegative = value < 0
        self.font = font
        self.textColor = textColor
        self.animationDuration = animationDuration
        self.prefix = prefix
        self.suffix = suffix
        self.value = .decimal(abs(value), decimalPlaces: decimalPlaces)
    }

    var body: some View {
        let currentElements = buildElements()

        HStack(spacing: 0) {
            if let prefix {
                Text(prefix)
                    .font(font)
                    .foregroundStyle(textColor)
            }

            if isNegative {
                Text("-")
                    .font(font)
                    .foregroundStyle(textColor)
            }

            ForEach(currentElements) { element in
                if element.isDigit {
                    SingleDigitReel(
                        digit: element.digitValue ?? 0,
                        font: font,
                        textColor: textColor,
                        isAnimated: isAnimated,
                        animationDuration: animationDuration
                    )
                    .transition(.opacity.combined(with: .scale))
                } else {
                    Text(element.value)
                        .font(font)
                        .foregroundStyle(textColor)
                        .transition(.opacity)
                }
            }

            if let suffix {
                Text(suffix)
                    .font(font)
                    .foregroundStyle(textColor)
            }
        }
        .animation(isAnimated ? .easeInOut(duration: animationDuration) : nil, value: currentElements.count)
        .onAppear {
            isAnimated = true
        }
    }

    // MARK: - Element Building

    private func buildElements() -> [DigitElement] {
        switch value {
        case .integer(let absValue, let separator):
            return Self.buildIntElements(absValue, separator: separator)
        case .decimal(let absValue, let decimalPlaces):
            return Self.buildDoubleElements(absValue, decimalPlaces: decimalPlaces)
        }
    }

    private static func buildIntElements(_ absValue: Int, separator: String?) -> [DigitElement] {
        let formatted: String
        if let sep = separator {
            let str = formatter.string(from: NSNumber(value: absValue)) ?? "0"
            formatted = str.replacingOccurrences(of: ",", with: sep)
        } else {
            formatted = "\(absValue)"
        }

        return Array(formatted.reversed())
            .enumerated()
            .map { index, char in
                let s = String(char)
                let isDigit = char.isWholeNumber
                return DigitElement(id: index, value: s, isDigit: isDigit)
            }
            .reversed()
    }

    private static func buildDoubleElements(_ absValue: Double, decimalPlaces: Int) -> [DigitElement] {
        let formatted = String(format: "%.\(decimalPlaces)f", absValue)

        return Array(formatted.reversed())
            .enumerated()
            .map { index, char in
                let s = String(char)
                let isDigit = char.isWholeNumber
                return DigitElement(id: index, value: s, isDigit: isDigit)
            }
            .reversed()
    }
}
