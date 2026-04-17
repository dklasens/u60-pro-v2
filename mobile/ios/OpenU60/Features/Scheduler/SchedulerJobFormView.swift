import SwiftUI

struct SchedulerJobFormView: View {
    @Bindable var viewModel: SchedulerViewModel
    let editingJob: SchedulerJob?
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var selectedTemplate: ActionTemplate
    @State private var scheduleType: String
    @State private var actionTime: Date
    @State private var selectedDays: Set<Int>
    @State private var onceDate: Date
    @State private var restoreEnabled: Bool
    @State private var restoreTime: Date

    private let dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    init(viewModel: SchedulerViewModel, editingJob: SchedulerJob? = nil) {
        self.viewModel = viewModel
        self.editingJob = editingJob

        if let job = editingJob {
            _name = State(initialValue: job.name)
            _selectedTemplate = State(initialValue: ActionTemplate.from(method: job.actionMethod, path: job.actionPath) ?? .airplaneOn)
            _scheduleType = State(initialValue: job.scheduleType)

            if let timeStr = job.scheduleTime {
                let parts = timeStr.split(separator: ":").compactMap { Int($0) }
                if parts.count == 2,
                   let date = Calendar.current.date(from: DateComponents(hour: parts[0], minute: parts[1])) {
                    _actionTime = State(initialValue: date)
                } else {
                    _actionTime = State(initialValue: Calendar.current.date(from: DateComponents(hour: 23, minute: 0)) ?? Date())
                }
            } else {
                _actionTime = State(initialValue: Calendar.current.date(from: DateComponents(hour: 23, minute: 0)) ?? Date())
            }

            _selectedDays = State(initialValue: Set(job.scheduleDays))

            if let at = job.scheduleAt {
                _onceDate = State(initialValue: Date(timeIntervalSince1970: TimeInterval(at)))
            } else {
                _onceDate = State(initialValue: Date().addingTimeInterval(3600))
            }

            _restoreEnabled = State(initialValue: job.restoreTime != nil)

            if let rtStr = job.restoreTime {
                let parts = rtStr.split(separator: ":").compactMap { Int($0) }
                if parts.count == 2,
                   let date = Calendar.current.date(from: DateComponents(hour: parts[0], minute: parts[1])) {
                    _restoreTime = State(initialValue: date)
                } else {
                    _restoreTime = State(initialValue: Calendar.current.date(from: DateComponents(hour: 6, minute: 30)) ?? Date())
                }
            } else {
                _restoreTime = State(initialValue: Calendar.current.date(from: DateComponents(hour: 6, minute: 30)) ?? Date())
            }
        } else {
            _name = State(initialValue: "")
            _selectedTemplate = State(initialValue: .airplaneOn)
            _scheduleType = State(initialValue: "recurring")
            _actionTime = State(initialValue: Calendar.current.date(from: DateComponents(hour: 23, minute: 0)) ?? Date())
            _selectedDays = State(initialValue: Set(0...4))
            _onceDate = State(initialValue: Date().addingTimeInterval(3600))
            _restoreEnabled = State(initialValue: false)
            _restoreTime = State(initialValue: Calendar.current.date(from: DateComponents(hour: 6, minute: 30)) ?? Date())
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("Automation name", text: $name)
                }

                Section("Action") {
                    Picker("Action", selection: $selectedTemplate) {
                        ForEach(ActionTemplate.allCases) { template in
                            Label(template.label, systemImage: template.systemImage)
                                .tag(template)
                        }
                    }
                }

                Section("Schedule") {
                    Picker("Type", selection: $scheduleType) {
                        Text("Recurring").tag("recurring")
                        Text("One-time").tag("once")
                    }
                    .pickerStyle(.segmented)

                    if scheduleType == "recurring" {
                        DatePicker("Time", selection: $actionTime, displayedComponents: .hourAndMinute)

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Days")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 8) {
                                ForEach(0..<7, id: \.self) { day in
                                    let isSelected = selectedDays.contains(day)
                                    Button {
                                        if isSelected {
                                            selectedDays.remove(day)
                                        } else {
                                            selectedDays.insert(day)
                                        }
                                    } label: {
                                        Text(dayLabels[day])
                                            .font(.subheadline)
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 8)
                                            .background(isSelected ? Color.accentColor : Color(.systemGray5))
                                            .foregroundStyle(isSelected ? .white : .primary)
                                            .clipShape(RoundedRectangle(cornerRadius: 8))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    } else {
                        DatePicker("Date & Time", selection: $onceDate, displayedComponents: [.date, .hourAndMinute])
                    }
                }

                if selectedTemplate.supportsRestore {
                    Section("Restore") {
                        Toggle("Reverse action at", isOn: $restoreEnabled)
                        if restoreEnabled {
                            DatePicker("Restore time", selection: $restoreTime, displayedComponents: .hourAndMinute)
                        }
                    }
                }

                Section {
                    Button {
                        Task {
                            if let job = editingJob {
                                await viewModel.updateJob(
                                    id: job.id,
                                    enabled: job.enabled,
                                    name: name,
                                    template: selectedTemplate,
                                    scheduleType: scheduleType,
                                    actionTime: actionTime,
                                    days: selectedDays,
                                    onceDate: onceDate,
                                    restoreEnabled: restoreEnabled,
                                    restoreTime: restoreTime
                                )
                            } else {
                                await viewModel.createJob(
                                    name: name,
                                    template: selectedTemplate,
                                    scheduleType: scheduleType,
                                    actionTime: actionTime,
                                    days: selectedDays,
                                    onceDate: onceDate,
                                    restoreEnabled: restoreEnabled,
                                    restoreTime: restoreTime
                                )
                            }
                            dismiss()
                        }
                    } label: {
                        Text("Save")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(name.isEmpty || (scheduleType == "recurring" && selectedDays.isEmpty))
                }
            }
            .navigationTitle(editingJob != nil ? "Edit Automation" : "New Automation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
