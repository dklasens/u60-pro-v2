package com.openu60.feature.router.wifi

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.openu60.core.model.GuestWiFiConfig
import com.openu60.core.model.WiFiConfig

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GuestWiFiSettingsScreen(
    onBack: () -> Unit,
    viewModel: GuestWiFiSettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) { viewModel.refresh() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Guest WiFi") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    TextButton(onClick = { viewModel.save() }, enabled = !state.isLoading) {
                        Text("Save")
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

                // Toggles
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Enable Guest Network", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        ToggleRow("2.4 GHz", state.config.enabled2g) {
                            viewModel.updateConfig(state.config.copy(enabled2g = it))
                        }
                        ToggleRow("5 GHz", state.config.enabled5g) {
                            viewModel.updateConfig(state.config.copy(enabled5g = it))
                        }
                    }
                }

                // Settings
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Settings", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))

                        OutlinedTextField(
                            value = state.config.ssid,
                            onValueChange = { viewModel.updateConfig(state.config.copy(ssid = it)) },
                            label = { Text("SSID") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = state.config.key,
                            onValueChange = { viewModel.updateConfig(state.config.copy(key = it)) },
                            label = { Text("Password") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        var encExpanded by remember { mutableStateOf(false) }
                        ExposedDropdownMenuBox(
                            expanded = encExpanded,
                            onExpandedChange = { encExpanded = it },
                        ) {
                            OutlinedTextField(
                                value = state.config.encryption,
                                onValueChange = {},
                                label = { Text("Encryption") },
                                readOnly = true,
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(encExpanded) },
                                modifier = Modifier.menuAnchor().fillMaxWidth(),
                                singleLine = true,
                            )
                            ExposedDropdownMenu(expanded = encExpanded, onDismissRequest = { encExpanded = false }) {
                                WiFiConfig.encryptionOptions.forEach { option ->
                                    DropdownMenuItem(
                                        text = { Text(option) },
                                        onClick = {
                                            viewModel.updateConfig(state.config.copy(encryption = option))
                                            encExpanded = false
                                        },
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        ToggleRow("Hidden Network", state.config.hidden) {
                            viewModel.updateConfig(state.config.copy(hidden = it))
                        }
                        ToggleRow("Client Isolation", state.config.isolate) {
                            viewModel.updateConfig(state.config.copy(isolate = it))
                        }
                    }
                }

                // Active Time
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Active Time", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))

                        var timeExpanded by remember { mutableStateOf(false) }
                        val selectedLabel = GuestWiFiConfig.activeTimeOptions.firstOrNull { it.second == state.config.activeTime }?.first ?: "No Limit"
                        ExposedDropdownMenuBox(
                            expanded = timeExpanded,
                            onExpandedChange = { timeExpanded = it },
                        ) {
                            OutlinedTextField(
                                value = selectedLabel,
                                onValueChange = {},
                                label = { Text("Duration") },
                                readOnly = true,
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(timeExpanded) },
                                modifier = Modifier.menuAnchor().fillMaxWidth(),
                                singleLine = true,
                            )
                            ExposedDropdownMenu(expanded = timeExpanded, onDismissRequest = { timeExpanded = false }) {
                                GuestWiFiConfig.activeTimeOptions.forEach { (label, value) ->
                                    DropdownMenuItem(
                                        text = { Text(label) },
                                        onClick = {
                                            viewModel.updateConfig(state.config.copy(activeTime = value))
                                            timeExpanded = false
                                        },
                                    )
                                }
                            }
                        }

                        if (state.remainingSeconds > 0) {
                            Spacer(modifier = Modifier.height(8.dp))
                            val mins = state.remainingSeconds / 60
                            val secs = state.remainingSeconds % 60
                            Text(
                                "Remaining: %d:%02d".format(mins, secs),
                                style = MaterialTheme.typography.bodyLarge,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label)
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}
