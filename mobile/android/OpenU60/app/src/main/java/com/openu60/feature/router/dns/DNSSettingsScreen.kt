package com.openu60.feature.router.dns

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DNSSettingsScreen(
    onBack: () -> Unit,
    onNavigateToCache: () -> Unit,
    viewModel: DNSSettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) { viewModel.refresh() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("DNS Settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (state.dnsMode != DNSMode.DOH) {
                        TextButton(onClick = { viewModel.saveDNS() }, enabled = !state.isLoading) {
                            Text("Save")
                        }
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

                // Mode tabs
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("DNS Mode", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        TabRow(
                            selectedTabIndex = state.dnsMode.ordinal,
                        ) {
                            Tab(
                                selected = state.dnsMode == DNSMode.AUTO,
                                onClick = { viewModel.setDnsMode(DNSMode.AUTO) },
                                text = { Text("Auto") },
                            )
                            Tab(
                                selected = state.dnsMode == DNSMode.CUSTOM,
                                onClick = { viewModel.setDnsMode(DNSMode.CUSTOM) },
                                text = { Text("Custom") },
                            )
                            Tab(
                                selected = state.dnsMode == DNSMode.DOH,
                                onClick = { viewModel.setDnsMode(DNSMode.DOH) },
                                text = { Text("DoH") },
                            )
                        }
                    }
                }

                // Custom DNS fields
                if (state.dnsMode == DNSMode.CUSTOM) {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Custom DNS", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = state.dnsConfig.primaryDns,
                                onValueChange = { viewModel.updateDnsConfig(state.dnsConfig.copy(primaryDns = it)) },
                                label = { Text("Primary DNS") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true,
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = state.dnsConfig.secondaryDns,
                                onValueChange = { viewModel.updateDnsConfig(state.dnsConfig.copy(secondaryDns = it)) },
                                label = { Text("Secondary DNS") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true,
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = state.dnsConfig.ipv6PrimaryDns,
                                onValueChange = { viewModel.updateDnsConfig(state.dnsConfig.copy(ipv6PrimaryDns = it)) },
                                label = { Text("IPv6 Primary DNS") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true,
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = state.dnsConfig.ipv6SecondaryDns,
                                onValueChange = { viewModel.updateDnsConfig(state.dnsConfig.copy(ipv6SecondaryDns = it)) },
                                label = { Text("IPv6 Secondary DNS") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true,
                            )
                        }
                    }
                }

                // DoH section
                if (state.dnsMode == DNSMode.DOH) {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("DNS-over-HTTPS", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(8.dp))

                            if (state.dohStatus.enabled) {
                                InfoRow("Status", "Running")
                                InfoRow("Upstream", state.dohStatus.upstreamUrl)
                                InfoRow("Cache Entries", "${state.dohStatus.cacheEntries}")
                                InfoRow("Queries", "${state.dohStatus.queriesTotal}")
                                InfoRow("Hit Ratio", "%.1f%%".format(state.dohStatus.hitRatio))

                                Spacer(modifier = Modifier.height(12.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedButton(
                                        onClick = { viewModel.disableDoH() },
                                        enabled = !state.isLoading,
                                        modifier = Modifier.weight(1f),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                                    ) { Text("Disable DoH") }
                                    Button(
                                        onClick = onNavigateToCache,
                                        modifier = Modifier.weight(1f),
                                    ) { Text("View Cache") }
                                }
                            } else {
                                Text("DoH is not running", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Spacer(modifier = Modifier.height(8.dp))
                                Button(
                                    onClick = { viewModel.enableDoH() },
                                    enabled = !state.isLoading,
                                    modifier = Modifier.fillMaxWidth(),
                                ) { Text("Enable DoH") }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value.ifBlank { "--" }, style = MaterialTheme.typography.bodyMedium, fontFamily = FontFamily.Monospace)
    }
}
