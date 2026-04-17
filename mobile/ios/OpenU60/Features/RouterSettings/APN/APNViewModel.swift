import SwiftUI

@Observable
@MainActor
final class APNViewModel {
    var config: APNConfig = .empty
    var isLoading: Bool = false
    var message: String?
    var messageIsError: Bool = false
    var showFormSheet: Bool = false

    // Form state
    var formProfile: APNProfile = .empty
    var editingProfile: APNProfile?  // nil = adding, non-nil = editing
    var setAsDefault: Bool = false

    private let client: AgentClient
    private let authManager: AuthManager

    var isEditing: Bool { editingProfile != nil }

    var activeAPNName: String? {
        let active = config.profiles.first(where: { $0.active })
            ?? config.autoProfiles.first(where: { $0.active })
        guard let active else { return nil }
        return active.name.isEmpty ? active.apn : active.name
    }

    init(client: AgentClient, authManager: AuthManager) {
        self.client = client
        self.authManager = authManager
    }

    func refresh() async {
        isLoading = true
        message = nil

        do {
            let modeData = try await client.getJSON("/api/router/apn/mode")
            let mode = APNParser.parseMode(modeData)

            let manuData = try await client.getJSON("/api/router/apn/profiles")
            let profiles = APNParser.parseProfiles(manuData)

            let autoData = try await client.getJSON("/api/router/apn/auto-profiles")
            let autoProfiles = APNParser.parseProfiles(autoData)

            config = APNConfig(mode: mode, profiles: profiles, autoProfiles: autoProfiles)
        } catch {
            showMessage("Failed to load APN: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func setMode(manual: Bool) async {
        isLoading = true

        do {
            let _ = try await client.putJSON("/api/router/apn/mode", body: ["apn_mode": manual ? 1 : 0])
            showMessage("APN mode set to \(manual ? "manual" : "auto")", isError: false)
            config = APNConfig(
                mode: manual ? "1" : "0",
                profiles: config.profiles,
                autoProfiles: config.autoProfiles
            )
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    // MARK: - Form Actions

    func startAdd() {
        editingProfile = nil
        formProfile = .empty
        setAsDefault = false
        showFormSheet = true
    }

    func startEdit(_ profile: APNProfile) {
        editingProfile = profile
        formProfile = profile
        setAsDefault = profile.active
        showFormSheet = true
    }

    func saveAPN() async {
        guard !formProfile.name.isEmpty, !formProfile.apn.isEmpty else {
            showMessage("Name and APN are required", isError: true)
            return
        }

        let isDuplicate = config.profiles.contains { p in
            p.name == formProfile.name && p.id != (editingProfile?.id ?? "")
        }
        if isDuplicate {
            showMessage("An APN with this name already exists", isError: true)
            return
        }

        if isEditing {
            await editAPN()
        } else {
            await addAPN()
        }
    }

    private func addAPN() async {
        isLoading = true

        let name = formProfile.name
        let apn = formProfile.apn
        let shouldSetDefault = setAsDefault

        do {
            let _ = try await client.postJSON("/api/router/apn/profiles", body: [
                "profilename": name,
                "wanapn": apn,
                "pdpType": formProfile.pdpType,
                "pppAuthMode": formProfile.authMode,
                "username": formProfile.username,
                "password": formProfile.password
            ])

            if shouldSetDefault {
                await refresh()
                if let newProfile = config.profiles.first(where: { $0.name == name && $0.apn == apn }) {
                    await activateAPN(newProfile)
                }
            }

            formProfile = .empty
            showFormSheet = false
            showMessage("APN added", isError: false)
            await refresh()
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    private func editAPN() async {
        guard let editing = editingProfile else { return }

        isLoading = true

        do {
            let _ = try await client.putJSON("/api/router/apn/profiles", body: [
                "profileId": editing.id,
                "profilename": formProfile.name,
                "wanapn": formProfile.apn,
                "pdpType": formProfile.pdpType,
                "pppAuthMode": formProfile.authMode,
                "username": formProfile.username,
                "password": formProfile.password
            ])

            if setAsDefault && !editing.active {
                await activateAPN(editing)
            }

            editingProfile = nil
            showFormSheet = false
            showMessage("APN updated", isError: false)
            await refresh()
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func deleteAPN(_ profile: APNProfile) async {
        if profile.active {
            showMessage("Cannot delete the active APN", isError: true)
            return
        }

        isLoading = true

        do {
            let _ = try await client.postJSON("/api/router/apn/profiles/delete", body: ["profileId": profile.id])
            showMessage("APN deleted", isError: false)
            config.profiles.removeAll { $0.id == profile.id }
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    func activateAPN(_ profile: APNProfile) async {
        isLoading = true

        do {
            let _ = try await client.postJSON("/api/router/apn/profiles/activate", body: ["profileId": profile.id])
            showMessage("APN activated", isError: false)
            config.profiles = config.profiles.map { p in
                var updated = p
                updated.active = p.id == profile.id
                return updated
            }
        } catch {
            showMessage("Failed: \(error.localizedDescription)", isError: true)
        }

        isLoading = false
    }

    private func showMessage(_ text: String, isError: Bool) {
        message = text
        messageIsError = isError
    }
}
