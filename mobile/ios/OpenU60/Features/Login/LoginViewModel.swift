import SwiftUI

@Observable
@MainActor
final class LoginViewModel {
    var password: String = ""
    var isLoading: Bool = false
    var errorMessage: String?
    var saveToKeychain: Bool = true

    let authManager: AuthManager

    init(authManager: AuthManager) {
        self.authManager = authManager
        // Pre-fill from Keychain if available
        if let stored = KeychainHelper.load(key: "router_password") {
            password = stored
        }
    }

    func login() async {
        guard !password.isEmpty else {
            errorMessage = "Please enter a password"
            return
        }
        isLoading = true
        errorMessage = nil

        await authManager.login(password: password)

        isLoading = false

        switch authManager.state {
        case .authenticated:
            if saveToKeychain {
                KeychainHelper.save(key: "router_password", value: password)
            }
            errorMessage = nil
        case .failed(let reason):
            errorMessage = reason
        default:
            break
        }
    }
}
