import SwiftUI

struct ToolsListView: View {
    let client: AgentClient
    let authManager: AuthManager

    var body: some View {
        NavigationStack {
            List {
                Section("Automation") {
                    NavigationLink {
                        SchedulerView(viewModel: SchedulerViewModel(client: client, authManager: authManager))
                    } label: {
                        Label("Automations", systemImage: "clock.arrow.2.circlepath")
                    }
                    NavigationLink {
                        SMSForwardConfigView(viewModel: SMSForwardViewModel(client: client, authManager: authManager))
                    } label: {
                        Label("SMS Forwarding", systemImage: "envelope.arrow.triangle.branch")
                    }
                }

                Section("Network Tools") {
                    NavigationLink {
                        SpeedTestView(viewModel: SpeedTestViewModel(client: client, authManager: authManager))
                    } label: {
                        Label("Speed Test", systemImage: "speedometer")
                    }

                    NavigationLink {
                        LANSpeedTestView(viewModel: LANSpeedTestViewModel(client: client))
                    } label: {
                        Label("LAN Speed Test", systemImage: "wifi")
                    }

                    NavigationLink {
                        EnableADBView(client: client, authManager: authManager)
                    } label: {
                        Label("Enable ADB", systemImage: "cable.connector.horizontal")
                    }

                    NavigationLink {
                        USBModeView(viewModel: USBConnectionViewModel(client: client, authManager: authManager))
                    } label: {
                        Label("USB Mode", systemImage: "cable.connector")
                    }

                    NavigationLink {
                        BandLockView(viewModel: BandLockViewModel(client: client, authManager: authManager))
                    } label: {
                        Label("Band Lock", systemImage: "lock.fill")
                    }

                    NavigationLink {
                        DeviceInfoView(viewModel: DeviceInfoViewModel(client: client, authManager: authManager))
                    } label: {
                        Label("Device Info", systemImage: "info.circle")
                    }

                    NavigationLink {
                        ClientsView(viewModel: ClientsViewModel(client: client, authManager: authManager))
                    } label: {
                        Label("Connected Devices", systemImage: "laptopcomputer.and.iphone")
                    }
                }

                Section("Config") {
                    NavigationLink {
                        ConfigToolView()
                    } label: {
                        Label("Config Decrypt/Encrypt", systemImage: "doc.badge.gearshape")
                    }
                }

                Section("Shell Access Required") {
                    NavigationLink {
                        PlaceholderView(title: "TTL Settings", icon: "number", description: "Set TTL override via iptables. Requires shell access.")
                    } label: {
                        Label("TTL Settings", systemImage: "number")
                    }

                    NavigationLink {
                        PlaceholderView(title: "Enable SSH", icon: "terminal", description: "Install and start dropbear SSH server. Requires ADB USB connection.")
                    } label: {
                        Label("Enable SSH", systemImage: "terminal")
                    }

                    NavigationLink {
                        PlaceholderView(title: "Device Explorer", icon: "folder", description: "Browse filesystem and collect device info. Requires ADB USB connection.")
                    } label: {
                        Label("Device Explorer", systemImage: "folder")
                    }
                }
            }
            .navigationTitle("Tools")
        }
    }
}
