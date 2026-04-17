import SwiftUI

struct APNView: View {
    @Bindable var viewModel: APNViewModel
    @State private var showAutoDetail: APNProfile?

    var body: some View {
        List {
            if let msg = viewModel.message {
                Section {
                    Text(msg)
                        .font(.subheadline)
                        .foregroundStyle(viewModel.messageIsError ? .red : .green)
                        .textSelection(.enabled)
                }
            }

            if let activeName = viewModel.activeAPNName {
                Section("Current APN") {
                    HStack {
                        Text(activeName)
                            .font(.headline)
                        Spacer()
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                }
            }

            Section("APN Mode") {
                Toggle("Manual APN", isOn: Binding(
                    get: { viewModel.config.isManual },
                    set: { manual in Task { await viewModel.setMode(manual: manual) } }
                ))
                .disabled(viewModel.isLoading)
            }

            if viewModel.config.isManual {
                Section {
                    Button {
                        viewModel.startAdd()
                    } label: {
                        Label("Add APN", systemImage: "plus")
                    }
                } header: {
                    Text("Manual Profiles")
                }

                if !viewModel.config.profiles.isEmpty {
                    Section {
                        ForEach(viewModel.config.profiles) { profile in
                            APNProfileRow(profile: profile)
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    viewModel.startEdit(profile)
                                }
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        Task { await viewModel.deleteAPN(profile) }
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                    .disabled(profile.active)
                                }
                                .swipeActions(edge: .leading) {
                                    if !profile.active {
                                        Button {
                                            Task { await viewModel.activateAPN(profile) }
                                        } label: {
                                            Label("Activate", systemImage: "checkmark.circle")
                                        }
                                        .tint(.green)
                                    }
                                }
                        }
                    }
                }
            } else {
                // Auto mode: show auto profiles read-only
                if !viewModel.config.autoProfiles.isEmpty {
                    Section("Auto Profiles") {
                        ForEach(viewModel.config.autoProfiles) { profile in
                            APNProfileRow(profile: profile)
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    showAutoDetail = profile
                                }
                        }
                    }
                }
            }
        }
        .navigationTitle("APN Settings")
        .refreshable { await viewModel.refresh() }
        .overlay {
            if viewModel.isLoading {
                ProgressView()
                    .padding()
                    .background(Color(.systemBackground).opacity(0.85), in: RoundedRectangle(cornerRadius: 8))
            }
        }
        .task { await viewModel.refresh() }
        .sheet(isPresented: $viewModel.showFormSheet) {
            APNFormSheet(viewModel: viewModel)
        }
        .sheet(item: $showAutoDetail) { profile in
            APNAutoDetailSheet(profile: profile)
        }
    }
}

// MARK: - Profile Row

private struct APNProfileRow: View {
    let profile: APNProfile

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(profile.name.isEmpty ? "Unnamed" : profile.name)
                    .font(.headline)
                Spacer()
                if profile.active {
                    Text("Active")
                        .font(.caption)
                        .foregroundStyle(.green)
                }
            }
            Text(profile.apn)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text("\(profile.pdpTypeLabel) / \(profile.authModeLabel)")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Add/Edit Form Sheet

struct APNFormSheet: View {
    @Bindable var viewModel: APNViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Profile") {
                    TextField("Name", text: $viewModel.formProfile.name)
                    TextField("APN", text: $viewModel.formProfile.apn)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                }

                Section("Connection") {
                    Picker("PDP Type", selection: $viewModel.formProfile.pdpType) {
                        ForEach(APNProfile.pdpTypeOptions, id: \.value) { opt in
                            Text(opt.label).tag(opt.value)
                        }
                    }

                    Picker("Auth Mode", selection: $viewModel.formProfile.authMode) {
                        ForEach(APNProfile.authModeOptions, id: \.value) { opt in
                            Text(opt.label).tag(opt.value)
                        }
                    }
                }

                if viewModel.formProfile.authMode != 0 {
                    Section("Credentials") {
                        TextField("Username", text: $viewModel.formProfile.username)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                        SecureField("Password", text: $viewModel.formProfile.password)
                    }
                }

                Section {
                    Toggle("Set as Default", isOn: $viewModel.setAsDefault)
                }

                Section {
                    Button {
                        Task { await viewModel.saveAPN() }
                    } label: {
                        Text(viewModel.isEditing ? "Save" : "Add APN")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(
                        viewModel.formProfile.name.isEmpty
                        || viewModel.formProfile.apn.isEmpty
                        || viewModel.isLoading
                    )
                }
            }
            .navigationTitle(viewModel.isEditing ? "Edit APN" : "New APN")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Auto APN Detail (Read-Only)

struct APNAutoDetailSheet: View {
    let profile: APNProfile
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Profile") {
                    LabeledContent("Name", value: profile.name.isEmpty ? "—" : profile.name)
                    LabeledContent("APN", value: profile.apn.isEmpty ? "—" : profile.apn)
                }
                Section("Connection") {
                    LabeledContent("PDP Type", value: profile.pdpTypeLabel)
                    LabeledContent("Auth Mode", value: profile.authModeLabel)
                }
                if profile.authMode != 0 {
                    Section("Credentials") {
                        LabeledContent("Username", value: profile.username.isEmpty ? "—" : profile.username)
                    }
                }
                Section {
                    LabeledContent("Status", value: profile.active ? "Active" : "Inactive")
                }
            }
            .navigationTitle("Auto APN")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
