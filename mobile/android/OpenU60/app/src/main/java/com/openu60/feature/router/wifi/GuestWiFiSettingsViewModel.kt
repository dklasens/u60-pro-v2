package com.openu60.feature.router.wifi

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.GuestWiFiConfig
import com.openu60.core.model.GuestWiFiParser
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class GuestWiFiSettingsState(
    val config: GuestWiFiConfig = GuestWiFiConfig.empty,
    val remainingSeconds: Int = -1,
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
)

@HiltViewModel
class GuestWiFiSettingsViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(GuestWiFiSettingsState())
    val state: StateFlow<GuestWiFiSettingsState> = _state.asStateFlow()

    private var countdownJob: Job? = null

    fun updateConfig(config: GuestWiFiConfig) {
        _state.value = _state.value.copy(config = config)
    }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val data = agentClient.getJSON("/api/wifi/guest")
                val config = GuestWiFiParser.parse(data)
                _state.value = _state.value.copy(config = config, remainingSeconds = config.remainingSeconds, isLoading = false)
                startCountdown(config.remainingSeconds)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) refresh() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun save() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val c = _state.value.config
                val params = mapOf(
                    "disabled_2g" to if (c.enabled2g) "0" else "1",
                    "disabled_5g" to if (c.enabled5g) "0" else "1",
                    "ssid" to c.ssid,
                    "key" to c.key,
                    "encryption" to c.encryption,
                    "hidden" to if (c.hidden) "1" else "0",
                    "isolate" to if (c.isolate) "1" else "0",
                    "guest_active_time" to c.activeTime.toString(),
                )
                agentClient.putJSON("/api/wifi/guest", params)
                _state.value = _state.value.copy(isLoading = false, message = "Guest WiFi settings saved", messageIsError = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) save() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun startCountdown(seconds: Int) {
        countdownJob?.cancel()
        if (seconds <= 0) return
        countdownJob = viewModelScope.launch {
            var remaining = seconds
            while (remaining > 0) {
                delay(1000)
                remaining--
                _state.value = _state.value.copy(remainingSeconds = remaining)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
