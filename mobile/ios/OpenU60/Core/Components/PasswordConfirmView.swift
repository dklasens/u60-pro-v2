import SwiftUI

struct PasswordConfirmView: View {
    let title: String
    let message: String
    let confirmLabel: String
    let onConfirm: () async -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var password: String = ""
    @State private var error: String?
    @State private var isProcessing: Bool = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(message)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Section {
                    SecureField("Router Password", text: $password)
                        .textContentType(.password)
                        .autocorrectionDisabled()
                }

                if let error {
                    Section {
                        Text(error)
                            .font(.subheadline)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button(role: .destructive) {
                        Task { await confirm() }
                    } label: {
                        HStack {
                            Spacer()
                            if isProcessing {
                                ProgressView()
                            } else {
                                Text(confirmLabel)
                            }
                            Spacer()
                        }
                    }
                    .disabled(password.isEmpty || isProcessing)
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func confirm() async {
        guard let storedPassword = KeychainHelper.load(key: "router_password") else {
            error = "No stored password found. Please log in again."
            return
        }

        guard password == storedPassword else {
            error = "Incorrect password"
            password = ""
            return
        }

        isProcessing = true
        await onConfirm()
        isProcessing = false
        dismiss()
    }
}
