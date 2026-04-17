package com.openu60.feature.router.firewall

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FirewallSettingsScreen(
    onBack: () -> Unit,
    onNavigateToPortForwardForm: () -> Unit = {},
    viewModel: FirewallSettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) { viewModel.refresh() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Firewall") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isLoading,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                state.message?.let { msg ->
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = if (state.messageIsError) MaterialTheme.colorScheme.errorContainer
                            else MaterialTheme.colorScheme.primaryContainer,
                        ),
                    ) {
                        Text(
                            msg,
                            modifier = Modifier.padding(16.dp),
                            color = if (state.messageIsError) MaterialTheme.colorScheme.onErrorContainer
                            else MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                    }
                }

                // Firewall toggles
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("General", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        ToggleRow("Firewall", state.config.enabled) { viewModel.toggleFirewall(it) }
                        ToggleRow("NAT", state.config.nat) { viewModel.toggleNAT(it) }
                        ToggleRow("Port Forwarding", state.config.portForwardEnabled) { viewModel.togglePortForward(it) }
                    }
                }

                // Firewall level
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Firewall Level", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        listOf("low", "medium", "high").forEach { level ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                RadioButton(
                                    selected = state.config.level == level,
                                    onClick = { viewModel.setFirewallLevel(level) },
                                    enabled = !state.isLoading,
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(level.replaceFirstChar { it.uppercase() })
                            }
                        }
                    }
                }

                // DMZ
                var dmzHost by remember(state.config.dmzHost) { mutableStateOf(state.config.dmzHost) }
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("DMZ", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        ToggleRow("DMZ Enabled", state.config.dmzEnabled) {
                            viewModel.setDMZ(it, dmzHost)
                        }
                        OutlinedTextField(
                            value = dmzHost,
                            onValueChange = { dmzHost = it },
                            label = { Text("DMZ Host IP") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(
                            onClick = { viewModel.setDMZ(state.config.dmzEnabled, dmzHost) },
                            enabled = !state.isLoading,
                        ) { Text("Save DMZ") }
                    }
                }

                // Port Forward Rules
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("Port Forward Rules", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            IconButton(onClick = { viewModel.showAddForm() }) {
                                Icon(Icons.Default.Add, contentDescription = "Add rule")
                            }
                        }
                        if (state.portForwardRules.isEmpty()) {
                            Text("No rules configured", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        } else {
                            state.portForwardRules.forEach { rule ->
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(rule.name.ifBlank { "Unnamed" }, fontWeight = FontWeight.Medium)
                                        Text(
                                            "${rule.protocol.uppercase()} WAN:${rule.wanPort} -> ${rule.lanIP}:${rule.lanPort}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                    IconButton(onClick = { viewModel.deletePortForwardRule(rule.id) }) {
                                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                                    }
                                }
                                HorizontalDivider()
                            }
                        }
                    }
                }

                // Inline port forward form
                if (state.showPortForwardForm) {
                    PortForwardFormInline(
                        onSubmit = { name, protocol, wanPort, lanIP, lanPort ->
                            viewModel.addPortForwardRule(name, protocol, wanPort, lanIP, lanPort, true)
                        },
                        onCancel = { viewModel.hideAddForm() },
                        isLoading = state.isLoading,
                    )
                }
            }
        }
    }
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onToggle: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge)
        Switch(checked = checked, onCheckedChange = onToggle)
    }
}

@Composable
private fun PortForwardFormInline(
    onSubmit: (String, String, String, String, String) -> Unit,
    onCancel: () -> Unit,
    isLoading: Boolean,
) {
    var name by remember { mutableStateOf("") }
    var protocol by remember { mutableStateOf("tcp") }
    var wanPort by remember { mutableStateOf("") }
    var lanIP by remember { mutableStateOf("") }
    var lanPort by remember { mutableStateOf("") }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Add Port Forward Rule", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("tcp", "udp", "both").forEach { proto ->
                    FilterChip(
                        selected = protocol == proto,
                        onClick = { protocol = proto },
                        label = { Text(proto.uppercase()) },
                    )
                }
            }
            OutlinedTextField(value = wanPort, onValueChange = { wanPort = it }, label = { Text("WAN Port") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(value = lanIP, onValueChange = { lanIP = it }, label = { Text("LAN IP") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(value = lanPort, onValueChange = { lanPort = it }, label = { Text("LAN Port") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = { onSubmit(name, protocol, wanPort, lanIP, lanPort) },
                    enabled = !isLoading && name.isNotBlank() && wanPort.isNotBlank() && lanIP.isNotBlank() && lanPort.isNotBlank(),
                ) { Text("Add") }
                OutlinedButton(onClick = onCancel) { Text("Cancel") }
            }
        }
    }
}
