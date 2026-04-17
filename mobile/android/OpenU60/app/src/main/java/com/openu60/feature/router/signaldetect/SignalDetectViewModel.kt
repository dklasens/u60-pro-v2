package com.openu60.feature.router.signaldetect

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.SignalDetectParser
import com.openu60.core.model.SignalDetectStatus
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SignalDetectState(
    val status: SignalDetectStatus = SignalDetectStatus.empty,
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
)

@HiltViewModel
class SignalDetectViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(SignalDetectState())
    val state: StateFlow<SignalDetectState> = _state.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val data = agentClient.getJSON("/api/cell/signal-detect/progress")
                val status = SignalDetectParser.parseProgress(data)
                _state.value = _state.value.copy(status = status, isLoading = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) refresh() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun startDetect() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/cell/signal-detect/start")
                // Poll until done
                while (true) {
                    delay(2000)
                    val data = agentClient.getJSON("/api/cell/signal-detect/progress")
                    val progress = SignalDetectParser.parseProgress(data)
                    _state.value = _state.value.copy(status = progress)
                    if (!progress.running) break
                }
                // Fetch results
                val resultData = agentClient.getJSON("/api/cell/signal-detect/progress")
                val results = SignalDetectParser.parseResults(resultData)
                _state.value = _state.value.copy(
                    status = _state.value.status.copy(results = results),
                    isLoading = false,
                    message = "Scan complete: ${results.size} results",
                    messageIsError = false,
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) startDetect() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
