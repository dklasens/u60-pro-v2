package com.openu60.feature.tools

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ToolsListScreen(
    onNavigateToDeviceInfo: () -> Unit,
    onNavigateToClients: () -> Unit,
    onNavigateToBandLock: () -> Unit,
    onNavigateToEnableADB: () -> Unit,
    onNavigateToConfigTool: () -> Unit,
    onNavigateToScheduler: () -> Unit,
    onNavigateToUSBMode: () -> Unit,
    onNavigateToSpeedTest: () -> Unit,
    onNavigateToLANSpeedTest: () -> Unit,
    onNavigateToSMSForward: () -> Unit,
    onNavigateToProcessList: () -> Unit,
    onNavigateToATConsole: () -> Unit,
    onNavigateToPlaceholder: (String) -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Tools") })
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                "Network Tools",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(bottom = 4.dp),
            )
            ToolItem(
                icon = Icons.Default.Info,
                title = "Device Info",
                subtitle = "SIM, IMEI, WAN IPs",
                onClick = onNavigateToDeviceInfo,
            )
            ToolItem(
                icon = Icons.Default.Devices,
                title = "Connected Devices",
                subtitle = "View connected clients and DHCP leases",
                onClick = onNavigateToClients,
            )
            ToolItem(
                icon = Icons.Default.CellTower,
                title = "Band Lock",
                subtitle = "Lock NR/LTE bands",
                onClick = onNavigateToBandLock,
            )
            ToolItem(
                icon = Icons.Default.Adb,
                title = "Enable ADB",
                subtitle = "Enable USB debug mode",
                onClick = onNavigateToEnableADB,
            )
            ToolItem(
                icon = Icons.Default.Schedule,
                title = "Scheduler",
                subtitle = "Schedule automated tasks",
                onClick = onNavigateToScheduler,
            )
            ToolItem(
                icon = Icons.Default.ForwardToInbox,
                title = "SMS Forwarding",
                subtitle = "Auto-forward SMS to Telegram, webhooks, etc.",
                onClick = onNavigateToSMSForward,
            )
            ToolItem(
                icon = Icons.Default.Usb,
                title = "USB Mode",
                subtitle = "USB mode and powerbank control",
                onClick = onNavigateToUSBMode,
            )
            ToolItem(
                icon = Icons.Default.Terminal,
                title = "AT Console",
                subtitle = "Send AT commands directly to modem",
                onClick = onNavigateToATConsole,
            )
            ToolItem(
                icon = Icons.Default.Speed,
                title = "Speed Test",
                subtitle = "Test WAN throughput",
                onClick = onNavigateToSpeedTest,
            )
            ToolItem(
                icon = Icons.Default.Wifi,
                title = "LAN Speed Test",
                subtitle = "Test WiFi link to router",
                onClick = onNavigateToLANSpeedTest,
            )
            ToolItem(
                icon = Icons.Default.Memory,
                title = "Process Monitor",
                subtitle = "View processes, kill bloat daemons",
                onClick = onNavigateToProcessList,
            )

            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "Config Tools",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(bottom = 4.dp),
            )
            ToolItem(
                icon = Icons.Default.Security,
                title = "Config Decrypt/Encrypt",
                subtitle = "Offline ZXHN config file tool",
                onClick = onNavigateToConfigTool,
            )

            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "ADB-Only Tools",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 4.dp),
            )
            ToolItem(
                icon = Icons.Default.Timer,
                title = "TTL Fix",
                subtitle = "Requires ADB USB connection",
                onClick = { onNavigateToPlaceholder("TTL Fix") },
                enabled = false,
            )
            ToolItem(
                icon = Icons.Default.Terminal,
                title = "SSH Access",
                subtitle = "Requires ADB USB connection",
                onClick = { onNavigateToPlaceholder("SSH Access") },
                enabled = false,
            )
            ToolItem(
                icon = Icons.Default.FolderOpen,
                title = "Device Explorer",
                subtitle = "Requires ADB USB connection",
                onClick = { onNavigateToPlaceholder("Device Explorer") },
                enabled = false,
            )
        }
    }
}

@Composable
private fun ToolItem(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (enabled) Modifier.clickable(onClick = onClick) else Modifier),
        colors = if (enabled) {
            CardDefaults.cardColors()
        } else {
            CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            )
        },
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                icon,
                contentDescription = null,
                modifier = Modifier.size(28.dp),
                tint = if (enabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = if (enabled) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                )
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (enabled) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                )
            }
            if (enabled) {
                Icon(
                    Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
