package com.openu60.feature.router.sim

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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SIMScreen(
    onBack: () -> Unit,
    viewModel: SIMViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    var showPinDialog by remember { mutableStateOf(false) }
    var showChangePinDialog by remember { mutableStateOf(false) }
    var showPukDialog by remember { mutableStateOf(false) }
    var showNckDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.refresh() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("SIM Management") },
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

                // SIM Info
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("SIM Information", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        InfoRow("Status", state.simInfo.simStatus)
                        InfoRow("Operator", state.simInfo.operatorName)
                        InfoRow("ICCID", state.simInfo.iccid)
                        InfoRow("IMSI", state.simInfo.imsi)
                        InfoRow("MSISDN", state.simInfo.msisdn)
                        InfoRow("SPN", state.simInfo.spn)
                        InfoRow("MCC/MNC", "${state.simInfo.mcc}/${state.simInfo.mnc}")
                        InfoRow("Slot", state.simInfo.currentSlot)
                    }
                }

                // PIN Management
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("PIN Management", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(4.dp))
                        InfoRow("PIN Status", state.simInfo.pinStatus)
                        InfoRow("PIN Attempts", "${state.simInfo.pinAttempts}")
                        InfoRow("PUK Attempts", "${state.simInfo.pukAttempts}")
                        Spacer(modifier = Modifier.height(8.dp))

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = { showPinDialog = true },
                                enabled = !state.isLoading,
                                modifier = Modifier.weight(1f),
                            ) { Text("Verify PIN") }
                            OutlinedButton(
                                onClick = { showChangePinDialog = true },
                                enabled = !state.isLoading,
                                modifier = Modifier.weight(1f),
                            ) { Text("Change PIN") }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = { showPukDialog = true },
                                enabled = !state.isLoading,
                                modifier = Modifier.weight(1f),
                            ) { Text("Enter PUK") }
                            OutlinedButton(
                                onClick = { showNckDialog = true },
                                enabled = !state.isLoading,
                                modifier = Modifier.weight(1f),
                            ) { Text("Unlock NCK") }
                        }
                    }
                }

                // SIM Lock info
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("SIM Lock", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        InfoRow("NCK Trials Left", "${state.lockInfo.availableTrials}")
                    }
                }
            }
        }
    }

    // PIN Verify Dialog
    if (showPinDialog) {
        PinInputDialog(
            title = "Verify PIN",
            onDismiss = { showPinDialog = false },
            onConfirm = { pin ->
                showPinDialog = false
                viewModel.verifyPIN(pin)
            },
        )
    }

    // Change PIN Dialog
    if (showChangePinDialog) {
        TwoPinInputDialog(
            title = "Change PIN",
            label1 = "Current PIN",
            label2 = "New PIN",
            onDismiss = { showChangePinDialog = false },
            onConfirm = { oldPin, newPin ->
                showChangePinDialog = false
                viewModel.changePIN(oldPin, newPin)
            },
        )
    }

    // PUK Dialog
    if (showPukDialog) {
        TwoPinInputDialog(
            title = "Enter PUK",
            label1 = "PUK Code",
            label2 = "New PIN",
            onDismiss = { showPukDialog = false },
            onConfirm = { puk, newPin ->
                showPukDialog = false
                viewModel.verifyPUK(puk, newPin)
            },
        )
    }

    // NCK Dialog
    if (showNckDialog) {
        PinInputDialog(
            title = "Unlock NCK",
            label = "NCK Code",
            onDismiss = { showNckDialog = false },
            onConfirm = { nck ->
                showNckDialog = false
                viewModel.unlockNCK(nck)
            },
        )
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

@Composable
private fun PinInputDialog(
    title: String,
    label: String = "PIN",
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    var value by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = value,
                onValueChange = { value = it },
                label = { Text(label) },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
            )
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(value) }, enabled = value.isNotBlank()) { Text("OK") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}

@Composable
private fun TwoPinInputDialog(
    title: String,
    label1: String,
    label2: String,
    onDismiss: () -> Unit,
    onConfirm: (String, String) -> Unit,
) {
    var value1 by remember { mutableStateOf("") }
    var value2 by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = value1,
                    onValueChange = { value1 = it },
                    label = { Text(label1) },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                )
                OutlinedTextField(
                    value = value2,
                    onValueChange = { value2 = it },
                    label = { Text(label2) },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(value1, value2) }, enabled = value1.isNotBlank() && value2.isNotBlank()) { Text("OK") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}
