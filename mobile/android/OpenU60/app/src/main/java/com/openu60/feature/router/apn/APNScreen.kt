package com.openu60.feature.router.apn

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.openu60.core.model.APNProfile

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun APNScreen(
    onBack: () -> Unit,
    viewModel: APNViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) { viewModel.refresh() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("APN Settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.showAddForm() }) {
                        Icon(Icons.Default.Add, contentDescription = "Add APN")
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

                // Mode toggle
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("APN Mode", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(
                                selected = !state.config.isManual,
                                onClick = { viewModel.setMode("0") },
                                enabled = !state.isLoading,
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Auto")
                            Spacer(modifier = Modifier.width(16.dp))
                            RadioButton(
                                selected = state.config.isManual,
                                onClick = { viewModel.setMode("1") },
                                enabled = !state.isLoading,
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Manual")
                        }
                    }
                }

                // Profiles
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Profiles", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))

                        if (state.config.profiles.isEmpty()) {
                            Text("No APN profiles", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }

                        state.config.profiles.forEach { profile ->
                            Card(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                colors = CardDefaults.cardColors(
                                    containerColor = if (profile.active) MaterialTheme.colorScheme.primaryContainer
                                    else MaterialTheme.colorScheme.surfaceVariant,
                                ),
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(profile.name.ifBlank { "Unnamed" }, fontWeight = FontWeight.Medium)
                                        Text(
                                            "APN: ${profile.apn}  ${profile.pdpTypeLabel}",
                                            style = MaterialTheme.typography.bodySmall,
                                            fontFamily = FontFamily.Monospace,
                                        )
                                    }
                                    Row {
                                        if (!profile.active) {
                                            TextButton(onClick = { viewModel.activateProfile(profile.id) }) {
                                                Text("Activate")
                                            }
                                        }
                                        IconButton(onClick = { viewModel.showEditForm(profile) }) {
                                            Icon(Icons.Default.Edit, contentDescription = "Edit", modifier = Modifier.size(18.dp))
                                        }
                                        IconButton(onClick = { viewModel.deleteProfile(profile.id) }) {
                                            Icon(Icons.Default.Delete, contentDescription = "Delete", modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.error)
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

    // Add/Edit form dialog
    if (state.showForm && state.editingProfile != null) {
        APNFormDialog(
            profile = state.editingProfile!!,
            onProfileChange = { viewModel.updateEditingProfile(it) },
            onDismiss = { viewModel.hideForm() },
            onSave = { viewModel.saveProfile() },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun APNFormDialog(
    profile: APNProfile,
    onProfileChange: (APNProfile) -> Unit,
    onDismiss: () -> Unit,
    onSave: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (profile.id.isNotBlank()) "Edit APN" else "Add APN") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = profile.name,
                    onValueChange = { onProfileChange(profile.copy(name = it)) },
                    label = { Text("Name") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                OutlinedTextField(
                    value = profile.apn,
                    onValueChange = { onProfileChange(profile.copy(apn = it)) },
                    label = { Text("APN") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )

                var pdpExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(expanded = pdpExpanded, onExpandedChange = { pdpExpanded = it }) {
                    OutlinedTextField(
                        value = profile.pdpTypeLabel,
                        onValueChange = {},
                        label = { Text("PDP Type") },
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(pdpExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                        singleLine = true,
                    )
                    ExposedDropdownMenu(expanded = pdpExpanded, onDismissRequest = { pdpExpanded = false }) {
                        APNProfile.pdpTypeOptions.forEach { (label, value) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = { onProfileChange(profile.copy(pdpType = value)); pdpExpanded = false },
                            )
                        }
                    }
                }

                var authExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(expanded = authExpanded, onExpandedChange = { authExpanded = it }) {
                    OutlinedTextField(
                        value = profile.authModeLabel,
                        onValueChange = {},
                        label = { Text("Auth Mode") },
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(authExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                        singleLine = true,
                    )
                    ExposedDropdownMenu(expanded = authExpanded, onDismissRequest = { authExpanded = false }) {
                        APNProfile.authModeOptions.forEach { (label, value) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = { onProfileChange(profile.copy(authMode = value)); authExpanded = false },
                            )
                        }
                    }
                }

                if (profile.authMode != 0) {
                    OutlinedTextField(
                        value = profile.username,
                        onValueChange = { onProfileChange(profile.copy(username = it)) },
                        label = { Text("Username") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = profile.password,
                        onValueChange = { onProfileChange(profile.copy(password = it)) },
                        label = { Text("Password") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onSave, enabled = profile.name.isNotBlank() && profile.apn.isNotBlank()) { Text("Save") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}
