import SwiftUI

struct SMSComposeView: View {
    var viewModel: SMSViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var number = ""
    @State private var messageText = ""
    @FocusState private var focusedField: Field?

    private enum Field { case number, message }

    private var charInfo: String {
        let encType = SMSParser.getEncodeType(messageText)
        let maxPerSegment = encType == "UNICODE" ? 67 : 153
        let maxTotal = encType == "UNICODE" ? 335 : 765
        let segments = messageText.isEmpty ? 0 : (messageText.count + maxPerSegment - 1) / maxPerSegment
        return "\(messageText.count)/\(maxTotal) (\(segments) SMS)"
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Phone Number", text: $number)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                        .focused($focusedField, equals: .number)
                }

                Section {
                    TextField("Message", text: $messageText, axis: .vertical)
                        .lineLimit(3...10)
                        .focused($focusedField, equals: .message)
                } footer: {
                    Text(charInfo)
                        .font(.caption.monospacedDigit())
                }

                Section {
                    Button {
                        let num = number
                        let msg = messageText
                        Task {
                            let success = await viewModel.sendSMS(to: num, message: msg)
                            if success { dismiss() }
                        }
                    } label: {
                        HStack {
                            Spacer()
                            if viewModel.isSending {
                                ProgressView()
                                    .padding(.trailing, 8)
                            }
                            Text("Send")
                                .fontWeight(.semibold)
                            Spacer()
                        }
                    }
                    .disabled(
                        number.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                        messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                        viewModel.isSending
                    )
                }

                if let error = viewModel.error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("New Message")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onAppear { focusedField = .number }
        }
    }
}
