import Foundation
import Observation

/// Manages authentication state and session tokens for the zte-agent API.
@Observable
@MainActor
final class AuthManager {
    enum AuthState: Equatable {
        case idle
        case authenticating
        case authenticated
        case failed(String)
    }

    var state: AuthState = .idle

    var sessionToken: String {
        client.token ?? ""
    }

    var isAuthenticated: Bool { state == .authenticated }

    private let client: AgentClient

    init(client: AgentClient) {
        self.client = client
    }

    /// Perform login with plaintext password via the agent.
    func login(password: String) async {
        state = .authenticating
        do {
            try await client.login(password: password)
            state = .authenticated
        } catch let error as AgentError {
            state = .failed(error.localizedDescription)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    /// Clear the current session.
    func logout() {
        client.token = nil
        state = .idle
    }

    /// Re-authenticate silently using stored credentials.
    /// Does NOT change auth state on failure.
    func reauthenticate() async -> Bool {
        guard let password = KeychainHelper.load(key: "router_password") else { return false }
        do {
            try await client.login(password: password)
            state = .authenticated
            return true
        } catch {
            return false
        }
    }
}

// MARK: - Keychain Helper

enum KeychainHelper {
    static func save(key: String, value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecAttrService as String: "com.openu60.app"
        ]
        SecItemDelete(query as CFDictionary)
        var addQuery = query
        addQuery[kSecValueData as String] = data
        SecItemAdd(addQuery as CFDictionary, nil)
    }

    static func load(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecAttrService as String: "com.openu60.app",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecAttrService as String: "com.openu60.app"
        ]
        SecItemDelete(query as CFDictionary)
    }
}
