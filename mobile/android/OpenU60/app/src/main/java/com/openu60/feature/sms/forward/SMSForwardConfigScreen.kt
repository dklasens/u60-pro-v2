package com.openu60.feature.sms.forward

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.openu60.core.model.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SMSForwardConfigScreen(
    onBack: () -> Unit,
    onNavigateToForm: () -> Unit,
    onNavigateToLog: () -> Unit,
    viewModel: SMSForwardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) { viewModel.refresh() }

    var configLoaded by remember { mutableStateOf(false) }
    var markRead by remember { mutableStateOf(false) }
    var deleteAfter by remember { mutableStateOf(false) }

    // Sync from server on first load and after pull-to-refresh
    LaunchedEffect(state.config, state.isLoading) {
        if (!configLoaded && !state.isLoading) {
            markRead = state.config.markReadAfterForward
            deleteAfter = state.config.deleteAfterForward
            configLoaded = true
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("SMS Forwarding") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = onNavigateToForm) {
                        Icon(Icons.Default.Add, contentDescription = "Add rule")
                    }
                },
            )
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isLoading,
            onRefresh = { configLoaded = false; viewModel.refresh() },
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxSize(),
            ) {
                // Message card
                state.message?.let { msg ->
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
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
                }

                // Global settings card
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Global Settings", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(12.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text("Enabled")
                                Switch(checked = state.config.enabled, onCheckedChange = { viewModel.toggleEnabled(it) })
                            }

                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text("Mark Read After Forward")
                                Switch(checked = markRead, onCheckedChange = { markRead = it })
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text("Delete After Forward")
                                Switch(checked = deleteAfter, onCheckedChange = { deleteAfter = it })
                            }

                            Spacer(modifier = Modifier.height(12.dp))
                            Button(
                                onClick = {
                                    viewModel.updateConfig(state.config.enabled, state.config.pollIntervalSecs, markRead, deleteAfter)
                                },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !state.isLoading,
                            ) { Text("Save Settings") }
                        }
                    }
                }

                // Rules section header
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Rules (${state.config.rules.size})",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        OutlinedButton(onClick = onNavigateToLog) {
                            Text("View Log")
                        }
                    }
                }

                // Rule cards
                if (state.config.rules.isEmpty() && !state.isLoading) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("No forwarding rules", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }

                items(state.config.rules, key = { it.id }) { rule ->
                    RuleCard(
                        rule = rule,
                        onToggle = { viewModel.toggleRule(rule.id, it) },
                        onDelete = { viewModel.deleteRule(rule.id) },
                    )
                }

                // Add rule button
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = onNavigateToForm,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Add Rule")
                    }
                }
            }
        }
    }
}

@Composable
private fun RuleCard(
    rule: ForwardRule,
    onToggle: (Boolean) -> Unit,
    onDelete: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(rule.name, fontWeight = FontWeight.Medium)
                Text(
                    filterSummary(rule.filter),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    destinationSummary(rule.destination),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Switch(checked = rule.enabled, onCheckedChange = onToggle)
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
            }
        }
    }
}

private fun filterSummary(filter: SmsFilter): String = when (filter) {
    is SmsFilter.All -> "All messages"
    is SmsFilter.Sender -> "Sender: ${filter.patterns.joinToString(", ")}"
    is SmsFilter.Content -> "Content: ${filter.keywords.joinToString(", ")}"
    is SmsFilter.SenderAndContent -> "Sender: ${filter.patterns.joinToString(", ")} + Content: ${filter.keywords.joinToString(", ")}"
}

private fun destinationSummary(dest: ForwardDestination): String = when (dest) {
    is ForwardDestination.Telegram -> "Telegram (${dest.chatId})"
    is ForwardDestination.Webhook -> "Webhook (${dest.url})"
    is ForwardDestination.Sms -> "SMS (${dest.forwardNumber})"
    is ForwardDestination.Ntfy -> "ntfy (${dest.topic})"
    is ForwardDestination.Discord -> "Discord webhook"
    is ForwardDestination.Slack -> "Slack webhook"
}
