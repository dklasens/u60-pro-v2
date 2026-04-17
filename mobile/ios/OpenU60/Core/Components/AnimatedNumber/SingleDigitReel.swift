import SwiftUI

struct SingleDigitReel: View {
    let digit: Int
    let font: Font
    let textColor: Color
    let isAnimated: Bool
    let animationDuration: Double

    private let totalSets = 7
    private let digitsPerSet = 10
    private var totalSlots: Int { totalSets * digitsPerSet }
    private var middleSetStart: Int { (totalSets / 2) * digitsPerSet }

    @State private var cumulativePosition: Int
    @State private var previousDigit: Int
    @State private var resetWorkItem: DispatchWorkItem?

    init(digit: Int, font: Font, textColor: Color, isAnimated: Bool, animationDuration: Double) {
        self.digit = digit
        self.font = font
        self.textColor = textColor
        self.isAnimated = isAnimated
        self.animationDuration = animationDuration

        let middleStart = (7 / 2) * 10
        _cumulativePosition = State(initialValue: middleStart + digit)
        _previousDigit = State(initialValue: digit)
        _resetWorkItem = State(initialValue: nil)
    }

    var body: some View {
        Text("8")
            .font(font.monospacedDigit())
            .foregroundStyle(.clear)
            .overlay {
                GeometryReader { proxy in
                    let slotHeight = proxy.size.height
                    VStack(spacing: 0) {
                        ForEach(0..<totalSlots, id: \.self) { index in
                            Text("\(index % digitsPerSet)")
                                .font(font.monospacedDigit())
                                .foregroundStyle(textColor)
                                .frame(width: proxy.size.width, height: slotHeight)
                        }
                    }
                    .offset(y: -CGFloat(cumulativePosition) * slotHeight)
                    .animation(
                        isAnimated ? .easeInOut(duration: animationDuration) : nil,
                        value: cumulativePosition
                    )
                }
            }
            .clipped()
            .onChange(of: digit) { oldValue, newValue in
                let delta = Self.shortestDelta(from: oldValue, to: newValue)
                cumulativePosition += delta
                self.previousDigit = newValue
                scheduleReset(to: newValue)
            }
    }

    /// Computes the shortest path on the mod-10 ring.
    /// Positive = forward (rolling down), negative = backward (rolling up).
    private static func shortestDelta(from: Int, to: Int) -> Int {
        let forward = (to - from + 10) % 10   // e.g. 9→0: (0-9+10)%10 = 1
        let backward = forward - 10            // e.g. 9→0: 1-10 = -9
        return abs(forward) <= abs(backward) ? forward : backward
    }

    /// After the animation completes, snap back to the middle set (no animation)
    /// to prevent unbounded offset growth.
    private func scheduleReset(to digit: Int) {
        resetWorkItem?.cancel()
        let midStart = middleSetStart
        let work = DispatchWorkItem {
            let targetPosition = midStart + digit
            if cumulativePosition != targetPosition {
                var transaction = Transaction()
                transaction.disablesAnimations = true
                withTransaction(transaction) {
                    cumulativePosition = targetPosition
                }
            }
        }
        resetWorkItem = work
        DispatchQueue.main.asyncAfter(
            deadline: .now() + animationDuration + 0.05,
            execute: work
        )
    }
}
