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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.openu60.core.model.WiFiConfig

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WiFiSettingsScreen(
    onBack: () -> Unit,
    viewModel: WiFiSettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) { viewModel.refresh() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("WiFi Settings") },
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

                // Global toggle
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("WiFi", fontWeight = FontWeight.Bold)
                        Switch(
                            checked = state.config.wifiOnOff,
                            onCheckedChange = { viewModel.updateConfig(state.config.copy(wifiOnOff = it)) },
                        )
                    }
                }

                // 2.4GHz
                BandCard(
                    title = "2.4 GHz",
                    ssid = state.config.ssid2g,
                    password = state.config.key2g,
                    channel = state.config.channel2g,
                    bandwidth = state.config.bandwidth2g,
                    txpower = state.config.txpower2g,
                    encryption = state.config.encryption2g,
                    hidden = state.config.hidden2g,
                    disabled = state.config.radio2gDisabled,
                    channelOptions = WiFiConfig.channelOptions2g,
                    bandwidthOptions = WiFiConfig.bandwidthOptions2g,
                    onSsidChange = { viewModel.updateConfig(state.config.copy(ssid2g = it)) },
                    onPasswordChange = { viewModel.updateConfig(state.config.copy(key2g = it)) },
                    onChannelChange = { viewModel.updateConfig(state.config.copy(channel2g = it)) },
                    onBandwidthChange = { viewModel.updateConfig(state.config.copy(bandwidth2g = it)) },
                    onTxpowerChange = { viewModel.updateConfig(state.config.copy(txpower2g = it)) },
                    onEncryptionChange = { viewModel.updateConfig(state.config.copy(encryption2g = it)) },
                    onHiddenChange = { viewModel.updateConfig(state.config.copy(hidden2g = it)) },
                    onDisabledChange = { viewModel.updateConfig(state.config.copy(radio2gDisabled = it)) },
                )

                // 5GHz
                val available5gChannels = WiFiConfig.channels5g(state.config.bandwidth5g)
                val available5gBandwidths = WiFiConfig.bandwidths5g(state.config.channel5g)
                BandCard(
                    title = "5 GHz",
                    ssid = state.config.ssid5g,
                    password = state.config.key5g,
                    channel = state.config.channel5g,
                    bandwidth = state.config.bandwidth5g,
                    txpower = state.config.txpower5g,
                    encryption = state.config.encryption5g,
                    hidden = state.config.hidden5g,
                    disabled = state.config.radio5gDisabled,
                    channelOptions = available5gChannels,
                    bandwidthOptions = available5gBandwidths,
                    onSsidChange = { viewModel.updateConfig(state.config.copy(ssid5g = it)) },
                    onPasswordChange = { viewModel.updateConfig(state.config.copy(key5g = it)) },
                    onChannelChange = {
                        var newConfig = state.config.copy(channel5g = it)
                        val validBw = WiFiConfig.bandwidths5g(it)
                        if (newConfig.bandwidth5g !in validBw) newConfig = newConfig.copy(bandwidth5g = "auto")
                        viewModel.updateConfig(newConfig)
                    },
                    onBandwidthChange = {
                        var newConfig = state.config.copy(bandwidth5g = it)
                        val validCh = WiFiConfig.channels5g(it)
                        if (newConfig.channel5g !in validCh) newConfig = newConfig.copy(channel5g = "auto")
                        viewModel.updateConfig(newConfig)
                    },
                    onTxpowerChange = { viewModel.updateConfig(state.config.copy(txpower5g = it)) },
                    onEncryptionChange = { viewModel.updateConfig(state.config.copy(encryption5g = it)) },
                    onHiddenChange = { viewModel.updateConfig(state.config.copy(hidden5g = it)) },
                    onDisabledChange = { viewModel.updateConfig(state.config.copy(radio5gDisabled = it)) },
                )

                // Advanced Card
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Advanced Settings", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = state.config.country,
                                onValueChange = { viewModel.updateConfig(state.config.copy(country = it)) },
                                label = { Text("Country Code") },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                            )
                            DropdownSelector(
                                label = "Max Clients",
                                selected = state.config.maxAssoc,
                                options = WiFiConfig.maxAssocOptions,
                                onSelect = { viewModel.updateConfig(state.config.copy(maxAssoc = it)) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BandCard(
    title: String,
    ssid: String,
    password: String,
    channel: String,
    bandwidth: String,
    txpower: String,
    encryption: String,
    hidden: Boolean,
    disabled: Boolean,
    channelOptions: List<String>,
    bandwidthOptions: List<String>,
    onSsidChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onChannelChange: (String) -> Unit,
    onBandwidthChange: (String) -> Unit,
    onTxpowerChange: (String) -> Unit,
    onEncryptionChange: (String) -> Unit,
    onHiddenChange: (Boolean) -> Unit,
    onDisabledChange: (Boolean) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Disabled", style = MaterialTheme.typography.bodySmall)
                    Spacer(modifier = Modifier.width(4.dp))
                    Switch(checked = disabled, onCheckedChange = onDisabledChange)
                }
            }
            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(value = ssid, onValueChange = onSsidChange, label = { Text("SSID") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(value = password, onValueChange = onPasswordChange, label = { Text("Password") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Spacer(modifier = Modifier.height(8.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DropdownSelector("Channel", channel, channelOptions, onChannelChange, Modifier.weight(1f))
                DropdownSelector("Bandwidth", bandwidth, bandwidthOptions, onBandwidthChange, Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DropdownSelector("Encryption", encryption, WiFiConfig.encryptionOptions, onEncryptionChange, Modifier.weight(1f))
                DropdownSelector("TX Power", txpower, WiFiConfig.txpowerOptions, onTxpowerChange, Modifier.weight(1f))
            }

            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Hidden Network")
                Switch(checked = hidden, onCheckedChange = onHiddenChange)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DropdownSelector(
    label: String,
    selected: String,
    options: List<String>,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = modifier,
    ) {
        OutlinedTextField(
            value = selected,
            onValueChange = {},
            label = { Text(label) },
            readOnly = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier.menuAnchor().fillMaxWidth(),
            singleLine = true,
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        onSelect(option)
                        expanded = false
                    },
                )
            }
        }
    }
}
