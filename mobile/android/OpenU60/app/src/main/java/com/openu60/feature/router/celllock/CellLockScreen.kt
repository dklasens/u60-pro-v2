package com.openu60.feature.router.celllock

import androidx.compose.foundation.clickable
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
fun CellLockScreen(
    onBack: () -> Unit,
    viewModel: CellLockViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) { viewModel.refresh() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Cell Lock") },
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

                // Current status
                if (state.status.locked) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer),
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Locked Cell", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(8.dp))
                            if (state.status.nrPCI.isNotBlank()) {
                                InfoRow("NR PCI", state.status.nrPCI)
                                InfoRow("NR EARFCN", state.status.nrEARFCN)
                                InfoRow("NR Band", state.status.nrBand)
                            }
                            if (state.status.ltePCI.isNotBlank()) {
                                InfoRow("LTE PCI", state.status.ltePCI)
                                InfoRow("LTE EARFCN", state.status.lteEARFCN)
                            }
                        }
                    }
                }

                // Lock controls
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Lock to Cell", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))

                        Text("NR (5G)", style = MaterialTheme.typography.labelLarge)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = state.nrPCI,
                                onValueChange = { viewModel.updateField("nrPCI", it) },
                                label = { Text("PCI") },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                            )
                            OutlinedTextField(
                                value = state.nrEARFCN,
                                onValueChange = { viewModel.updateField("nrEARFCN", it) },
                                label = { Text("EARFCN") },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                            )
                            OutlinedTextField(
                                value = state.nrBand,
                                onValueChange = { viewModel.updateField("nrBand", it) },
                                label = { Text("Band") },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                            )
                        }
                        Button(
                            onClick = { viewModel.lockNRCell() },
                            enabled = !state.isLoading && state.nrPCI.isNotBlank(),
                            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                        ) { Text("Lock NR (5G)") }

                        Spacer(modifier = Modifier.height(16.dp))
                        Text("LTE", style = MaterialTheme.typography.labelLarge)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = state.ltePCI,
                                onValueChange = { viewModel.updateField("ltePCI", it) },
                                label = { Text("PCI") },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                            )
                            OutlinedTextField(
                                value = state.lteEARFCN,
                                onValueChange = { viewModel.updateField("lteEARFCN", it) },
                                label = { Text("EARFCN") },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                            )
                        }
                        Button(
                            onClick = { viewModel.lockLTECell() },
                            enabled = !state.isLoading && state.ltePCI.isNotBlank(),
                            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                        ) { Text("Lock LTE") }

                        Spacer(modifier = Modifier.height(16.dp))
                        OutlinedButton(
                            onClick = { viewModel.resetCellLock() },
                            enabled = !state.isLoading,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                        ) { Text("Reset All Locks") }
                    }
                }

                // Neighbor scan
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Neighbor Cells", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(
                            onClick = { viewModel.scanNeighbors() },
                            enabled = !state.isLoading,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("Scan Neighbors") }

                        if (state.neighbors.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(8.dp))
                            state.neighbors.forEach { cell ->
                                Card(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 2.dp)
                                        .clickable {
                                            if (cell.type == "NR") {
                                                viewModel.updateField("nrPCI", cell.pci)
                                                viewModel.updateField("nrEARFCN", cell.earfcn)
                                                viewModel.updateField("nrBand", cell.band)
                                            } else {
                                                viewModel.updateField("ltePCI", cell.pci)
                                                viewModel.updateField("lteEARFCN", cell.earfcn)
                                            }
                                        },
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                                ) {
                                    Row(
                                        modifier = Modifier.padding(8.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                    ) {
                                        Column {
                                            Text("${cell.type} - PCI: ${cell.pci}  EARFCN: ${cell.earfcn}", fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
                                            Text("Band: ${cell.band}  RSRP: ${cell.rsrp}", fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
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
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value.ifBlank { "--" }, style = MaterialTheme.typography.bodyMedium, fontFamily = FontFamily.Monospace)
    }
}
