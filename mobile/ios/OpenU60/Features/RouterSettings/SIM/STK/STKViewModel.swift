import SwiftUI

@Observable
@MainActor
final class STKViewModel {
    // USSD state
    var ussdCode: String = ""
    var ussdReply: String = ""
    var ussdResponse: USSDResponse = .empty
    var showUssdResponse: Bool = false

    // STK state
    var stkMenu: STKMenu = .empty
    var menuStack: [STKMenu] = []
    var stkNotSupported: Bool = false

    // Common
    var isLoading: Bool = false
    var message: String?
    var messageIsError: Bool = false

    private let client: AgentClient
    private let authManager: AuthManager

    init(client: AgentClient, authManager: AuthManager) {
        self.client = client
        self.authManager = authManager
    }

    var hasSTKMenu: Bool {
        !stkMenu.items.isEmpty
    }

    // MARK: - USSD

    func sendUSSD() async {
        let code = ussdCode.trimmingCharacters(in: .whitespaces)
        guard !code.isEmpty else {
            showMessage("Enter a USSD code", isError: true)
            return
        }

        isLoading = true
        message = nil

        do {
            let data = try await client.postJSON("/api/ussd/send", body: ["code": code])

            if let error = STKParser.parseError(data) {
                showMessage(error, isError: true)
            } else {
                ussdResponse = STKParser.parseUSSDResponse(data)
                showUssdResponse = true
            }
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func respondUSSD() async {
        let reply = ussdReply.trimmingCharacters(in: .whitespaces)
        guard !reply.isEmpty else { return }

        isLoading = true

        do {
            let data = try await client.postJSON("/api/ussd/respond", body: ["reply": reply])

            if let error = STKParser.parseError(data) {
                showMessage(error, isError: true)
            } else {
                ussdResponse = STKParser.parseUSSDResponse(data)
                ussdReply = ""
            }
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func cancelUSSD() async {
        isLoading = true

        do {
            let _ = try await client.postJSON("/api/ussd/cancel")
            ussdResponse = .empty
            showUssdResponse = false
            ussdReply = ""
            showMessage("USSD session ended", isError: false)
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    // MARK: - STK

    func loadSTKMenu() async {
        isLoading = true
        message = nil
        stkNotSupported = false

        do {
            let data = try await client.getJSON("/api/stk/menu")

            if let error = STKParser.parseError(data) {
                showMessage(error, isError: true)
            } else if data["supported"] as? Bool == false {
                stkNotSupported = true
            } else {
                stkMenu = STKParser.parseSTKMenu(data)
                menuStack = []
            }
        } catch {
            showMessage("STK not available", isError: true)
        }

        isLoading = false
    }

    func selectSTKItem(_ item: STKMenuItem) async {
        isLoading = true

        do {
            let data = try await client.postJSON("/api/stk/select", body: ["item_id": item.id])

            if let error = STKParser.parseError(data) {
                showMessage(error, isError: true)
            } else if data["supported"] as? Bool == false {
                stkNotSupported = true
            } else {
                let responseType = data["type"] as? String ?? ""
                if responseType == "menu" {
                    let subMenu = STKParser.parseSTKMenu(data)
                    if !subMenu.items.isEmpty {
                        menuStack.append(stkMenu)
                        stkMenu = subMenu
                    }
                } else {
                    // Raw response or display text
                    let rawData = data["data"] as? String ?? "No response"
                    showMessage(rawData, isError: false)
                }
            }
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func goBackSTK() {
        if let previous = menuStack.popLast() {
            stkMenu = previous
        }
    }

    // MARK: - Private

    private func showMessage(_ text: String, isError: Bool) {
        message = text
        messageIsError = isError
    }
}
