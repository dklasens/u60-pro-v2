import Foundation

enum AgentError: LocalizedError {
    case unauthorized
    case serverError(String)
    case networkError(Error)
    case decodingError(String)
    case serverUnreachable
    case timeout

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Not authenticated. Please log in."
        case .serverError(let message):
            return "Server error: \(message)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let detail):
            return "Failed to decode response: \(detail)"
        case .serverUnreachable:
            return "Cannot reach the agent"
        case .timeout:
            return "Request timed out"
        }
    }
}
