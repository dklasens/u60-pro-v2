import SwiftUI

struct TabBarView: View {
    let client: AgentClient
    let authManager: AuthManager
    @AppStorage("poll_interval") private var pollInterval: Double = 2.0

    private enum Tab: Hashable { case dashboard, sms, tools, router, settings }
    @State private var selectedTab: Tab = .dashboard

    @State private var dashboardVM: DashboardViewModel
    @State private var smsVM: SMSViewModel
    @State private var usbVM: USBConnectionViewModel

    private struct DashboardPollKey: Equatable {
        let interval: Double
        let active: Bool
    }

    init(client: AgentClient, authManager: AuthManager) {
        self.client = client
        self.authManager = authManager
        _dashboardVM = State(initialValue: DashboardViewModel(client: client, authManager: authManager))
        _smsVM = State(initialValue: SMSViewModel(client: client, authManager: authManager))
        _usbVM = State(initialValue: USBConnectionViewModel(client: client, authManager: authManager))
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView(viewModel: dashboardVM, isAuthenticated: authManager.isAuthenticated,
                         client: client, authManager: authManager)
                .tabItem {
                    Label("Dashboard", systemImage: "gauge.with.needle")
                }
                .tag(Tab.dashboard)

            SMSListView(viewModel: smsVM, client: client, authManager: authManager)
                .tabItem {
                    Label("SMS", systemImage: "message")
                }
                .tag(Tab.sms)

            ToolsListView(client: client, authManager: authManager)
                .tabItem {
                    Label("Tools", systemImage: "wrench.and.screwdriver")
                }
                .tag(Tab.tools)

            RouterSettingsListView(client: client, authManager: authManager)
                .tabItem {
                    Label("Router", systemImage: "wifi.router")
                }
                .tag(Tab.router)

            SettingsView(client: client)
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(Tab.settings)
        }
        .task(id: DashboardPollKey(interval: pollInterval, active: selectedTab == .dashboard)) {
            guard selectedTab == .dashboard else { return }
            dashboardVM.startPolling(interval: pollInterval)
            defer { dashboardVM.stopPolling() }
            // Keep task alive until cancelled; sleep throws CancellationError, caught by try?
            try? await Task.sleep(for: .seconds(86400 * 365))
        }
        .task {
            usbVM.startPolling(interval: 3.0)
            defer { usbVM.stopPolling() }
            try? await Task.sleep(for: .seconds(86400 * 365))
        }
        .sheet(isPresented: $usbVM.showModeSheet) {
            USBModeSheetView(viewModel: usbVM)
        }
    }
}
