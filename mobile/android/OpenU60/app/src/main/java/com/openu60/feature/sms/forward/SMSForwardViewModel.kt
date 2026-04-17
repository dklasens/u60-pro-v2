package com.openu60.feature.sms.forward

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.*
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SMSForwardState(
    val config: SmsForwardConfig = SmsForwardConfig(),
    val log: List<ForwardLogEntry> = emptyList(),
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
)

@HiltViewModel
class SMSForwardViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(SMSForwardState())
    val state: StateFlow<SMSForwardState> = _state.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val data = agentClient.getJSON("/api/sms/forward/config")
                val config = SMSForwardParser.parseConfig(data)
                _state.value = _state.value.copy(config = config, isLoading = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) refresh() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun updateConfig(
        enabled: Boolean,
        pollIntervalSecs: Long,
        markRead: Boolean,
        deleteAfter: Boolean,
    ) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.putJSON("/api/sms/forward/config", mapOf(
                    "enabled" to enabled,
                    "poll_interval_secs" to pollIntervalSecs,
                    "mark_read_after_forward" to markRead,
                    "delete_after_forward" to deleteAfter,
                ))
                _state.value = _state.value.copy(
                    config = _state.value.config.copy(
                        enabled = enabled,
                        pollIntervalSecs = pollIntervalSecs,
                        markReadAfterForward = markRead,
                        deleteAfterForward = deleteAfter,
                    ),
                    isLoading = false,
                    message = "Config saved",
                    messageIsError = false,
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) updateConfig(enabled, pollIntervalSecs, markRead, deleteAfter)
                else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun toggleEnabled(enabled: Boolean) {
        val previous = _state.value.config.enabled
        _state.value = _state.value.copy(
            config = _state.value.config.copy(enabled = enabled)
        )
        viewModelScope.launch {
            try {
                agentClient.putJSON("/api/sms/forward/config", mapOf(
                    "enabled" to enabled,
                    "poll_interval_secs" to _state.value.config.pollIntervalSecs,
                    "mark_read_after_forward" to _state.value.config.markReadAfterForward,
                    "delete_after_forward" to _state.value.config.deleteAfterForward,
                ))
                // Re-assert in case refresh() overwrote during coroutine suspension
                _state.value = _state.value.copy(
                    config = _state.value.config.copy(enabled = enabled)
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) toggleEnabled(enabled)
                else revertEnabled(previous, e.message)
            } catch (e: Exception) {
                revertEnabled(previous, e.message)
            }
        }
    }

    private fun revertEnabled(previous: Boolean, msg: String?) {
        _state.value = _state.value.copy(
            config = _state.value.config.copy(enabled = previous),
            message = msg ?: "Failed to toggle",
            messageIsError = true,
        )
    }

    fun createRule(name: String, filter: SmsFilter, destination: ForwardDestination) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/sms/forward/rules", mapOf(
                    "name" to name,
                    "filter" to SMSForwardParser.filterToMap(filter),
                    "destination" to SMSForwardParser.destinationToMap(destination),
                ))
                _state.value = _state.value.copy(
                    message = "Rule created",
                    messageIsError = false,
                )
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) createRule(name, filter, destination)
                else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun updateRule(id: Int, name: String, enabled: Boolean, filter: SmsFilter, destination: ForwardDestination) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.putJSON("/api/sms/forward/rules", mapOf(
                    "id" to id,
                    "name" to name,
                    "enabled" to enabled,
                    "filter" to SMSForwardParser.filterToMap(filter),
                    "destination" to SMSForwardParser.destinationToMap(destination),
                ))
                _state.value = _state.value.copy(
                    message = "Rule updated",
                    messageIsError = false,
                )
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) updateRule(id, name, enabled, filter, destination)
                else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun deleteRule(id: Int) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.deleteJSON("/api/sms/forward/rules", mapOf("id" to id))
                _state.value = _state.value.copy(message = "Rule deleted", messageIsError = false)
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) deleteRule(id) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun toggleRule(id: Int, enabled: Boolean) {
        viewModelScope.launch {
            _state.value = _state.value.copy(message = null)
            try {
                agentClient.putJSON("/api/sms/forward/rules/toggle", mapOf(
                    "id" to id,
                    "enabled" to enabled,
                ))
                _state.value = _state.value.copy(
                    config = _state.value.config.copy(
                        rules = _state.value.config.rules.map {
                            if (it.id == id) it.copy(enabled = enabled) else it
                        },
                    ),
                    message = "Rule ${if (enabled) "enabled" else "disabled"}",
                    messageIsError = false,
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) toggleRule(id, enabled) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun testDestination(destination: ForwardDestination) {
        viewModelScope.launch {
            _state.value = _state.value.copy(message = null)
            try {
                agentClient.postJSON("/api/sms/forward/test", mapOf(
                    "destination" to SMSForwardParser.destinationToMap(destination),
                ))
                _state.value = _state.value.copy(
                    message = "Test message sent successfully",
                    messageIsError = false,
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) testDestination(destination) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun fetchLog() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val data = agentClient.getJSONArray("/api/sms/forward/log")
                val log = data.mapNotNull { SMSForwardParser.parseLogEntry(it) }
                _state.value = _state.value.copy(log = log, isLoading = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) fetchLog() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun clearLog() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/sms/forward/log/clear")
                _state.value = _state.value.copy(
                    log = emptyList(),
                    isLoading = false,
                    message = "Log cleared",
                    messageIsError = false,
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) clearLog() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
