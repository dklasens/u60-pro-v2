package com.openu60.feature.router.signaldetect

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignalDetectScreen(
    onBack: () -> Unit,
    viewModel: SignalDetectViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) { viewModel.refresh() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Signal Detect") },
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

                // Start button + progress
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Button(
                            onClick = { viewModel.startDetect() },
                            enabled = !state.isLoading && !state.status.running,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("Start Signal Scan") }

                        if (state.status.running) {
                            Spacer(modifier = Modifier.height(8.dp))
                            LinearProgressIndicator(
                                progress = { state.status.progress / 100f },
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Text(
                                "${state.status.progress}%",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }

                // Results table
                if (state.status.results.isNotEmpty()) {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Results (${state.status.results.size})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(8.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                            ) {
                                Column {
                                    // Header
                                    Row {
                                        TableCell("Type", FontWeight.Bold)
                                        TableCell("Band", FontWeight.Bold)
                                        TableCell("EARFCN", FontWeight.Bold)
                                        TableCell("PCI", FontWeight.Bold)
                                        TableCell("RSRP", FontWeight.Bold)
                                        TableCell("RSRQ", FontWeight.Bold)
                                        TableCell("SINR", FontWeight.Bold)
                                    }
                                    HorizontalDivider()
                                    state.status.results.forEach { result ->
                                        Row {
                                            TableCell(result.type)
                                            TableCell(result.band)
                                            TableCell(result.earfcn)
                                            TableCell(result.pci)
                                            TableCell(result.rsrp)
                                            TableCell(result.rsrq)
                                            TableCell(result.sinr)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TableCell(text: String, weight: FontWeight = FontWeight.Normal) {
    Text(
        text.ifBlank { "--" },
        modifier = Modifier.width(72.dp).padding(vertical = 4.dp),
        style = MaterialTheme.typography.bodySmall,
        fontWeight = weight,
    )
}
