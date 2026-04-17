package com.openu60.feature.tools.process

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.openu60.core.model.ProcessInfo

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProcessListScreen(
    onBack: () -> Unit,
    viewModel: ProcessListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    var showKillAllConfirm by remember { mutableStateOf(false) }
    var killSinglePid by remember { mutableStateOf<Int?>(null) }

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Processes") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (state.bloatCount > 0) {
                        TextButton(
                            onClick = { showKillAllConfirm = true },
                            colors = ButtonDefaults.textButtonColors(
                                contentColor = MaterialTheme.colorScheme.error,
                            ),
                        ) {
                            Text("Kill All Bloat")
                        }
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isLoading && state.processes.isEmpty(),
            onRefresh = { viewModel.refresh() },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                // Summary card
                if (state.bloatCount > 0) {
                    item {
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f),
                            ),
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(
                                    Icons.Default.Warning,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.size(24.dp),
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        "${state.bloatCount} Bloat Daemons",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.error,
                                    )
                                    Text(
                                        "CPU: ${String.format("%.1f", state.bloatCpuPct)}%  RSS: ${formatKB(state.bloatRssKb)}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                }

                // Error
                state.error?.let { error ->
                    item {
                        Text(
                            error,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }

                // Process list
                items(state.processes, key = { it.pid }) { proc ->
                    ProcessRow(
                        process = proc,
                        onKill = if (proc.isBloat) {{ killSinglePid = proc.pid }} else null,
                    )
                }
            }
        }
    }

    // Kill all confirmation
    if (showKillAllConfirm) {
        AlertDialog(
            onDismissRequest = { showKillAllConfirm = false },
            title = { Text("Kill All Bloat Daemons?") },
            text = { Text("This will SIGKILL ${state.bloatCount} bloat daemons. They will return on reboot.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showKillAllConfirm = false
                        viewModel.killBloat()
                    },
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error,
                    ),
                ) {
                    Text("Kill All")
                }
            },
            dismissButton = {
                TextButton(onClick = { showKillAllConfirm = false }) {
                    Text("Cancel")
                }
            },
        )
    }

    // Kill single confirmation
    killSinglePid?.let { pid ->
        val proc = state.processes.find { it.pid == pid }
        AlertDialog(
            onDismissRequest = { killSinglePid = null },
            title = { Text("Kill ${proc?.name ?: "PID $pid"}?") },
            text = { Text("SIGKILL PID $pid. It will return on reboot.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        killSinglePid = null
                        viewModel.killBloat(listOf(pid))
                    },
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error,
                    ),
                ) {
                    Text("Kill")
                }
            },
            dismissButton = {
                TextButton(onClick = { killSinglePid = null }) {
                    Text("Cancel")
                }
            },
        )
    }
}

@Composable
private fun ProcessRow(
    process: ProcessInfo,
    onKill: (() -> Unit)?,
) {
    Card(
        colors = if (process.isBloat) {
            CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.15f),
            )
        } else {
            CardDefaults.cardColors()
        },
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    process.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    color = if (process.isBloat) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "PID ${process.pid} \u00B7 ${process.state}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    "${String.format("%.1f", process.cpuPct)}%",
                    style = MaterialTheme.typography.bodyMedium,
                    fontFamily = FontFamily.Monospace,
                    color = when {
                        process.cpuPct > 10 -> MaterialTheme.colorScheme.error
                        process.cpuPct > 2 -> MaterialTheme.colorScheme.tertiary
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    },
                )
                Text(
                    formatKB(process.rssKb),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (onKill != null) {
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(onClick = onKill, modifier = Modifier.size(32.dp)) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = "Kill",
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
        }
    }
}

private fun formatKB(kb: Long): String {
    return if (kb >= 1024) {
        String.format("%.1f MB", kb / 1024.0)
    } else {
        "$kb KB"
    }
}
