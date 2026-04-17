package com.openu60.feature.signal

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.openu60.core.network.AuthState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignalMonitorScreen(
    viewModel: SignalMonitorViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val authState by viewModel.authState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Signal Monitor") })
        },
    ) { padding ->
        if (authState != AuthState.LOGGED_IN) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center,
            ) {
                Text("Login required to monitor signal")
            }
            return@Scaffold
        }

        PullToRefreshBox(
            isRefreshing = state.isLoading,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (state.error != null) {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer,
                        ),
                    ) {
                        Text(
                            state.error!!,
                            modifier = Modifier.padding(16.dp),
                            color = MaterialTheme.colorScheme.onErrorContainer,
                        )
                    }
                }

                // Operator info bar
                val op = state.operatorInfo
                if (op.provider.isNotBlank()) {
                    Text(
                        "${op.provider} | ${op.displayNetworkType(state.nr.isConnected, state.lte)} | Signal: ${op.signalBar}/5",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                // NR Signal Panel
                val nr = state.nr
                if (nr.hasSignal) {
                    SignalPanel(
                        title = "5G NR",
                        rows = listOf(
                            SignalRow("RSRP", nr.rsrp?.let { "${it.toInt()} dBm" } ?: "--", rsrpColor(nr.rsrp)),
                            SignalRow("RSRQ", nr.rsrq?.let { "${it.toInt()} dB" } ?: "--"),
                            SignalRow("SINR", nr.sinr?.let { "${it.toInt()} dB" } ?: "--", sinrColor(nr.sinr)),
                            SignalRow("RSSI", nr.rssi?.let { "${it.toInt()} dBm" } ?: "--"),
                            SignalRow("Band", if (nr.band.isNotBlank()) "n${nr.band}" else "--"),
                            SignalRow("PCI", nr.pci.ifBlank { "--" }),
                            SignalRow("Cell ID", nr.cellID.ifBlank { "--" }),
                            SignalRow("ARFCN", nr.channel.ifBlank { "--" }),
                            SignalRow("Bandwidth", nr.bandwidth.ifBlank { "--" }),
                            SignalRow("CA", nr.carrierAggregation.ifBlank { "--" }),
                        ),
                    )
                }

                // LTE Signal Panel
                val lte = state.lte
                if (lte.hasSignal) {
                    SignalPanel(
                        title = "LTE",
                        rows = listOf(
                            SignalRow("RSRP", lte.rsrp?.let { "${it.toInt()} dBm" } ?: "--", rsrpColor(lte.rsrp)),
                            SignalRow("RSRQ", lte.rsrq?.let { "${it.toInt()} dB" } ?: "--"),
                            SignalRow("SINR", lte.sinr?.let { "${it.toInt()} dB" } ?: "--", sinrColor(lte.sinr)),
                            SignalRow("RSSI", lte.rssi?.let { "${it.toInt()} dBm" } ?: "--"),
                            SignalRow("CA", lte.carrierAggregation.ifBlank { "--" }),
                            SignalRow("CA State", lte.caState.ifBlank { "--" }),
                        ),
                    )
                }

                // WCDMA Signal Panel
                val wcdma = state.wcdma
                if (wcdma.rscp != null || wcdma.ecio != null) {
                    SignalPanel(
                        title = "WCDMA",
                        rows = listOf(
                            SignalRow("RSCP", wcdma.rscp?.let { "${it.toInt()} dBm" } ?: "--"),
                            SignalRow("Ec/Io", wcdma.ecio?.let { "${it.toInt()} dB" } ?: "--"),
                        ),
                    )
                }

                // RSRP History chart
                if (state.history.size > 1) {
                    RSRPHistoryCard(state.history)
                }
            }
        }
    }
}

private data class SignalRow(
    val label: String,
    val value: String,
    val color: Color = Color.Unspecified,
)

@Composable
private fun SignalPanel(title: String, rows: List<SignalRow>) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(8.dp))
            rows.forEach { row ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 2.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        row.label,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        row.value,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        color = if (row.color != Color.Unspecified) row.color else MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }
    }
}

@Composable
private fun RSRPHistoryCard(history: List<com.openu60.core.model.SignalSnapshot>) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "RSRP History",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(8.dp))

            val nrValues = history.mapNotNull { it.nrRSRP }
            val lteValues = history.mapNotNull { it.lteRSRP }

            if (nrValues.isNotEmpty()) {
                Text(
                    "NR: min ${nrValues.minOrNull()?.toInt() ?: 0} / avg ${nrValues.average().toInt()} / max ${nrValues.maxOrNull()?.toInt() ?: 0} dBm",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            if (lteValues.isNotEmpty()) {
                Text(
                    "LTE: min ${lteValues.minOrNull()?.toInt() ?: 0} / avg ${lteValues.average().toInt()} / max ${lteValues.maxOrNull()?.toInt() ?: 0} dBm",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Spacer(modifier = Modifier.height(8.dp))

            // Simple text-based sparkline for RSRP history
            val values = nrValues.ifEmpty { lteValues }
            if (values.size >= 2) {
                val barChars = "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588"
                val minVal = values.minOrNull()?.toFloat() ?: 0f
                val maxVal = values.maxOrNull()?.toFloat() ?: 0f
                val range = (maxVal - minVal).coerceAtLeast(1f)
                val sparkline = values.joinToString("") { v ->
                    val idx = ((v.toFloat() - minVal) / range * (barChars.length - 1)).toInt()
                        .coerceIn(0, barChars.length - 1)
                    barChars[idx].toString()
                }
                Text(
                    sparkline,
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

private fun rsrpColor(rsrp: Double?): Color {
    if (rsrp == null) return Color.Unspecified
    return when {
        rsrp >= -80 -> Color(0xFF4CAF50)
        rsrp >= -100 -> Color(0xFFFFEB3B)
        rsrp >= -110 -> Color(0xFFFF9800)
        else -> Color(0xFFF44336)
    }
}

private fun sinrColor(sinr: Double?): Color {
    if (sinr == null) return Color.Unspecified
    return when {
        sinr >= 20 -> Color(0xFF4CAF50)
        sinr >= 10 -> Color(0xFFFFEB3B)
        sinr >= 0 -> Color(0xFFFF9800)
        else -> Color(0xFFF44336)
    }
}
