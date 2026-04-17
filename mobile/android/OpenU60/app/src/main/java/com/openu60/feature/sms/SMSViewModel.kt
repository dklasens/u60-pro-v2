package com.openu60.feature.sms

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.*
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import com.openu60.core.network.AuthState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SMSViewModel @Inject constructor(
    private val client: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _storageFilter = MutableStateFlow(SMSStorageFilter.ALL)
    val storageFilter = _storageFilter.asStateFlow()

    private val _conversations = MutableStateFlow<List<SMSConversation>>(emptyList())
    val conversations = _conversations.asStateFlow()

    private val _allMessages = MutableStateFlow<List<SMSMessage>>(emptyList())
    val allMessages = _allMessages.asStateFlow()

    private val _capacity = MutableStateFlow(SMSCapacity.empty)
    val capacity = _capacity.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading = _isLoading.asStateFlow()

    private val _isSending = MutableStateFlow(false)
    val isSending = _isSending.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error = _error.asStateFlow()

    val authState = authManager.authState

    fun refresh() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                fetchMessages()
                fetchCapacity()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) {
                    try {
                        fetchMessages()
                        fetchCapacity()
                    } catch (e2: Exception) {
                        _error.value = e2.message
                    }
                } else {
                    _error.value = "Session expired"
                }
            } catch (e: Exception) {
                _error.value = e.message
            }
            _isLoading.value = false
        }
    }

    private suspend fun fetchMessages() {
        val body = mapOf(
            "page" to 0,
            "data_per_page" to 500,
            "mem_store" to _storageFilter.value.memStoreValue,
            "tags" to 10,
            "order_by" to "order by id desc",
        )
        val data = client.postJSON("/api/sms/list", body)
        val messages = SMSParser.parseMessages(data)
        _allMessages.value = messages
        _conversations.value = SMSParser.groupIntoConversations(messages)
    }

    private suspend fun fetchCapacity() {
        try {
            val data = client.getJSON("/api/sms/capacity")
            _capacity.value = SMSParser.parseCapacity(data)
        } catch (_: Exception) {}
    }

    fun sendSMS(number: String, text: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _isSending.value = true
            _error.value = null
            try {
                val encodeType = SMSParser.getEncodeType(text)
                val messageBody = if (encodeType == "UNICODE") {
                    SMSParser.encodeUCS2Hex(text)
                } else {
                    text
                }
                val smsTime = SMSParser.formatSMSTime()
                val body = mapOf(
                    "number" to number,
                    "sms_time" to smsTime,
                    "message_body" to messageBody,
                    "id" to "-1",
                    "encode_type" to encodeType,
                )
                client.postJSON("/api/sms/send", body)
                onSuccess()
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) {
                    try {
                        val encodeType = SMSParser.getEncodeType(text)
                        val messageBody = if (encodeType == "UNICODE") {
                            SMSParser.encodeUCS2Hex(text)
                        } else {
                            text
                        }
                        val smsTime = SMSParser.formatSMSTime()
                        val body = mapOf(
                            "number" to number,
                            "sms_time" to smsTime,
                            "message_body" to messageBody,
                            "id" to "-1",
                            "encode_type" to encodeType,
                        )
                        client.postJSON("/api/sms/send", body)
                        onSuccess()
                        refresh()
                    } catch (e2: Exception) {
                        _error.value = "Failed to send: ${e2.message}"
                    }
                } else {
                    _error.value = "Session expired"
                }
            } catch (e: Exception) {
                _error.value = "Failed to send: ${e.message}"
            }
            _isSending.value = false
        }
    }

    fun deleteMessages(ids: List<Int>) {
        viewModelScope.launch {
            try {
                val idStr = ids.joinToString(";")
                client.postJSON("/api/sms/delete", mapOf("id" to idStr))
                refresh()
            } catch (_: Exception) {}
        }
    }

    fun markAsRead(ids: List<Int>) {
        viewModelScope.launch {
            try {
                val idStr = ids.joinToString(";")
                client.postJSON("/api/sms/read", mapOf("id" to idStr, "tag" to 0))
            } catch (_: Exception) {}
        }
    }

    fun setStorageFilter(filter: SMSStorageFilter) {
        _storageFilter.value = filter
        refresh()
    }

    fun messagesForNumber(normalizedNumber: String): List<SMSMessage> {
        return _allMessages.value.filter {
            SMSParser.normalizeNumber(it.number) == normalizedNumber
        }.sortedBy { it.date }
    }
}
