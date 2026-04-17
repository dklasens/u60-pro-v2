package com.openu60.feature.sms

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.openu60.core.model.SMSMessage
import com.openu60.core.model.SMSTag
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SMSConversationScreen(
    normalizedNumber: String,
    onBack: () -> Unit,
    viewModel: SMSViewModel = hiltViewModel(),
) {
    val allMessages by viewModel.allMessages.collectAsState()
    val isSending by viewModel.isSending.collectAsState()
    val conversations by viewModel.conversations.collectAsState()
    var messageText by remember { mutableStateOf("") }

    // Load messages if this is a fresh ViewModel instance (separate nav destination)
    LaunchedEffect(Unit) {
        if (allMessages.isEmpty()) {
            viewModel.refresh()
        }
    }

    val displayNumber = conversations.firstOrNull { it.normalizedNumber == normalizedNumber }?.number ?: normalizedNumber
    val messages = remember(allMessages, normalizedNumber) {
        viewModel.messagesForNumber(normalizedNumber)
    }

    // Mark unread messages as read
    LaunchedEffect(messages) {
        val unreadIds = messages.filter { it.tag == SMSTag.UNREAD }.map { it.id }
        if (unreadIds.isNotEmpty()) {
            viewModel.markAsRead(unreadIds)
        }
    }

    val listState = rememberLazyListState()
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(displayNumber) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
        bottomBar = {
            Surface(tonalElevation = 3.dp) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(8.dp)
                        .imePadding(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedTextField(
                        value = messageText,
                        onValueChange = { messageText = it },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("Message") },
                        maxLines = 4,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    if (isSending) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                    } else {
                        IconButton(
                            onClick = {
                                if (messageText.isNotBlank()) {
                                    val text = messageText
                                    messageText = ""
                                    viewModel.sendSMS(displayNumber, text) {}
                                }
                            },
                            enabled = messageText.isNotBlank(),
                        ) {
                            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
                        }
                    }
                }
            }
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 12.dp),
            state = listState,
            verticalArrangement = Arrangement.spacedBy(6.dp),
            contentPadding = PaddingValues(vertical = 8.dp),
        ) {
            items(messages, key = { it.id }) { message ->
                MessageBubble(message)
            }
        }
    }
}

@Composable
private fun MessageBubble(message: SMSMessage) {
    val isIncoming = message.tag.isIncoming
    val alignment = if (isIncoming) Alignment.Start else Alignment.End
    val bgColor = if (isIncoming) {
        MaterialTheme.colorScheme.surfaceVariant
    } else {
        MaterialTheme.colorScheme.primaryContainer
    }
    val textColor = if (isIncoming) {
        MaterialTheme.colorScheme.onSurfaceVariant
    } else {
        MaterialTheme.colorScheme.onPrimaryContainer
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = alignment,
    ) {
        Surface(
            shape = RoundedCornerShape(
                topStart = 16.dp,
                topEnd = 16.dp,
                bottomStart = if (isIncoming) 4.dp else 16.dp,
                bottomEnd = if (isIncoming) 16.dp else 4.dp,
            ),
            color = bgColor,
            modifier = Modifier.widthIn(max = 300.dp),
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    message.content,
                    color = textColor,
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    SimpleDateFormat("HH:mm", Locale.getDefault()).format(message.date),
                    style = MaterialTheme.typography.labelSmall,
                    color = textColor.copy(alpha = 0.6f),
                )
            }
        }
    }
}
