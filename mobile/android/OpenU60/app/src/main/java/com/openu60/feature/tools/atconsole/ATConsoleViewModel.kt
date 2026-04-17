package com.openu60.feature.tools.atconsole

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ATCommandHistory(
    val command: String,
    val response: String,
    val isError: Boolean = false,
    val timestamp: Long = System.currentTimeMillis()
)

data class ATConsoleState(
    val history: List<ATCommandHistory> = emptyList(),
    val isLoading: Boolean = false,
    val currentCommand: String = "",
    val timeoutSeconds: Int = 5,
    val error: String? = null
)

@HiltViewModel
class ATConsoleViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(ATConsoleState())
    val state: StateFlow<ATConsoleState> = _state.asStateFlow()

    fun updateCommand(command: String) {
        _state.value = _state.value.copy(currentCommand = command)
    }

    fun updateTimeout(timeout: Int) {
        _state.value = _state.value.copy(timeoutSeconds = timeout)
    }

    fun sendCommand() {
        val cmd = _state.value.currentCommand.trim()
        if (cmd.isEmpty() || _state.value.isLoading) return

        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val response = agentClient.atSend(cmd, _state.value.timeoutSeconds)
                val entry = ATCommandHistory(cmd, response)
                _state.value = _state.value.copy(
                    history = _state.value.history + entry,
                    currentCommand = "",
                    isLoading = false
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) sendCommand()
                else _state.value = _state.value.copy(isLoading = false, error = e.message)
            } catch (e: Exception) {
                val entry = ATCommandHistory(cmd, e.message ?: "Unknown error", isError = true)
                _state.value = _state.value.copy(
                    history = _state.value.history + entry,
                    isLoading = false
                )
            }
        }
    }

    fun clearHistory() {
        _state.value = _state.value.copy(history = emptyList())
    }
}
