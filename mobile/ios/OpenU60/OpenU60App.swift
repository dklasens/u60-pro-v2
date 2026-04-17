import SwiftUI

@main
struct OpenU60App: App {
    @State private var authManager: AuthManager
    @State private var isAttemptingAutoLogin = true
    @AppStorage("gateway_ip") private var gatewayIP: String = "192.168.0.1"
    @AppStorage("dark_mode_override") private var darkModeOverride: Int = 0

    private let client: AgentClient

    init() {
        let savedIP = UserDefaults.standard.string(forKey: "gateway_ip") ?? "192.168.0.1"
        let agentClient = AgentClient(baseURL: "http://\(savedIP):9090")
        self.client = agentClient
        _authManager = State(initialValue: AuthManager(client: agentClient))

        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithTransparentBackground()
        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().compactAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance

        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithOpaqueBackground()
        UITabBar.appearance().standardAppearance = tabAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabAppearance
    }

    var body: some Scene {
        WindowGroup {
            rootView
                .preferredColorScheme(colorScheme)
                .onChange(of: gatewayIP) {
                    client.baseURL = "http://\(gatewayIP):9090"
                }
        }
    }

    @ViewBuilder
    private var rootView: some View {
        if authManager.isAuthenticated {
            TabBarView(client: client, authManager: authManager)
        } else if isAttemptingAutoLogin {
            VStack(spacing: 16) {
                Image(systemName: "wifi.router.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(.blue)
                Text("ZTE U60 Pro")
                    .font(.title.bold())
                ProgressView()
            }
            .task {
                if KeychainHelper.load(key: "router_password") != nil {
                    if await authManager.reauthenticate() {
                        return
                    }
                }
                isAttemptingAutoLogin = false
            }
        } else {
            LoginView(authManager: authManager)
        }
    }

    private var colorScheme: ColorScheme? {
        switch darkModeOverride {
        case 1: return .light
        case 2: return .dark
        default: return nil
        }
    }
}
