package com.openu60.feature.router.stk

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun STKScreen(
    onBack: () -> Unit,
    viewModel: STKViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) { viewModel.loadSTKMenu() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("STK / USSD") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
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

            // USSD Section
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("USSD", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = state.ussdCode,
                        onValueChange = { viewModel.updateUssdCode(it) },
                        label = { Text("USSD Code (e.g. *#06#)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = { viewModel.sendUSSD() },
                        enabled = !state.isLoading && state.ussdCode.isNotBlank(),
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Send USSD") }

                    if (state.showUssdResponse) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text("Response", fontWeight = FontWeight.Medium)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(state.ussdResponse.response.ifBlank { state.ussdResponse.rawResponse })

                                if (state.ussdResponse.sessionActive) {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    OutlinedTextField(
                                        value = state.ussdReply,
                                        onValueChange = { viewModel.updateUssdReply(it) },
                                        label = { Text("Reply") },
                                        modifier = Modifier.fillMaxWidth(),
                                        singleLine = true,
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Button(
                                            onClick = { viewModel.respondUSSD() },
                                            enabled = !state.isLoading && state.ussdReply.isNotBlank(),
                                            modifier = Modifier.weight(1f),
                                        ) { Text("Reply") }
                                        OutlinedButton(
                                            onClick = { viewModel.cancelUSSD() },
                                            enabled = !state.isLoading,
                                            modifier = Modifier.weight(1f),
                                        ) { Text("Cancel") }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // STK Section
            if (!state.stkNotSupported) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(
                                state.stkMenu.title.ifBlank { "STK Menu" },
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                            )
                            if (state.menuStack.isNotEmpty()) {
                                TextButton(onClick = { viewModel.goBackSTK() }) { Text("Back") }
                            }
                        }

                        if (state.isLoading) {
                            Spacer(modifier = Modifier.height(8.dp))
                            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        if (state.stkMenu.items.isEmpty() && !state.isLoading) {
                            Text("No menu items available", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        state.stkMenu.items.forEach { item ->
                            Card(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                                onClick = { viewModel.selectSTKItem(item) },
                            ) {
                                Text(
                                    item.label,
                                    modifier = Modifier.padding(12.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
