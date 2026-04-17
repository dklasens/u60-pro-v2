package com.openu60.feature.router.sim

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.SIMInfo
import com.openu60.core.model.SIMLockInfo
import com.openu60.core.model.SIMParser
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SIMState(
    val simInfo: SIMInfo = SIMInfo.empty,
    val lockInfo: SIMLockInfo = SIMLockInfo.empty,
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
)

@HiltViewModel
class SIMViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(SIMState())
    val state: StateFlow<SIMState> = _state.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val infoDeferred = async { agentClient.getJSON("/api/sim/info") }
                val lockDeferred = async { agentClient.getJSON("/api/sim/lock-trials") }
                val simInfo = SIMParser.parseSIMInfo(infoDeferred.await())
                val lockInfo = SIMParser.parseSIMLock(lockDeferred.await())
                _state.value = _state.value.copy(simInfo = simInfo, lockInfo = lockInfo, isLoading = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) refresh() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun verifyPIN(pin: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/sim/pin/verify", mapOf("pin" to pin))
                _state.value = _state.value.copy(isLoading = false, message = "PIN verified", messageIsError = false)
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) verifyPIN(pin) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun changePIN(oldPin: String, newPin: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/sim/pin/change", mapOf("old_pin" to oldPin, "new_pin" to newPin))
                _state.value = _state.value.copy(isLoading = false, message = "PIN changed", messageIsError = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) changePIN(oldPin, newPin) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun togglePINMode(enabled: Boolean, pin: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/sim/pin/mode", mapOf("enable" to enabled, "pin" to pin))
                _state.value = _state.value.copy(
                    isLoading = false,
                    message = if (enabled) "PIN lock enabled" else "PIN lock disabled",
                    messageIsError = false,
                )
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) togglePINMode(enabled, pin) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun verifyPUK(puk: String, newPin: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/sim/pin/verify", mapOf("puk" to puk, "new_pin" to newPin))
                _state.value = _state.value.copy(isLoading = false, message = "PUK verified, PIN reset", messageIsError = false)
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) verifyPUK(puk, newPin) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun unlockNCK(nck: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/sim/unlock", mapOf("nck" to nck))
                _state.value = _state.value.copy(isLoading = false, message = "SIM unlocked", messageIsError = false)
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) unlockNCK(nck) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
