package com.openu60.feature.scheduler

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.openu60.core.model.ActionTemplate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SchedulerFormScreen(
    onBack: () -> Unit,
    viewModel: SchedulerViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    var name by remember { mutableStateOf("") }
    var selectedTemplate by remember { mutableStateOf(ActionTemplate.REBOOT) }
    var scheduleType by remember { mutableStateOf("recurring") }
    var scheduleTime by remember { mutableStateOf("03:00") }
    var selectedDays by remember { mutableStateOf(setOf(0, 1, 2, 3, 4, 5, 6)) }
    var enableRestore by remember { mutableStateOf(false) }
    var restoreTime by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("New Scheduled Job") },
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

            // Name
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Job Name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )

            // Action template
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Action", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    ActionTemplate.entries.forEach { template ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = selectedTemplate == template,
                                onClick = { selectedTemplate = template },
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(template.label)
                        }
                    }
                }
            }

            // Schedule type
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Schedule", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Row {
                        listOf("recurring" to "Recurring", "once" to "One-time").forEach { (value, label) ->
                            Row(
                                modifier = Modifier.padding(end = 16.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                RadioButton(
                                    selected = scheduleType == value,
                                    onClick = { scheduleType = value },
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(label)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = scheduleTime,
                        onValueChange = { scheduleTime = it },
                        label = { Text("Time (HH:MM)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )

                    if (scheduleType == "recurring") {
                        Spacer(modifier = Modifier.height(8.dp))
                        val dayNames = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            dayNames.forEachIndexed { index, day ->
                                FilterChip(
                                    selected = index in selectedDays,
                                    onClick = {
                                        selectedDays = if (index in selectedDays) selectedDays - index else selectedDays + index
                                    },
                                    label = { Text(day) },
                                )
                            }
                        }
                    }
                }
            }

            // Restore
            if (selectedTemplate.supportsRestore) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("Restore After", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Switch(checked = enableRestore, onCheckedChange = { enableRestore = it })
                        }
                        if (enableRestore) {
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = restoreTime,
                                onValueChange = { restoreTime = it },
                                label = { Text("Restore Time (HH:MM)") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true,
                            )
                        }
                    }
                }
            }

            // Submit
            Button(
                onClick = {
                    viewModel.createJob(
                        name = name,
                        template = selectedTemplate,
                        scheduleType = scheduleType,
                        scheduleTime = scheduleTime,
                        scheduleDays = selectedDays.sorted(),
                        scheduleAt = null,
                        restoreTime = if (enableRestore && restoreTime.isNotBlank()) restoreTime else null,
                    )
                },
                enabled = name.isNotBlank() && !state.isLoading,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Create Job") }
        }
    }
}
