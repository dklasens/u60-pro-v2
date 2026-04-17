package com.openu60.feature.usb

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.DeviceParser
import com.openu60.core.model.USBStatus
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class USBModeState(
    val usbStatus: USBStatus = USBStatus.empty,
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
    val showModeSheet: Boolean = false,
)

@HiltViewModel
class USBModeViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(USBModeState())
    val state: StateFlow<USBModeState> = _state.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val usbData = agentClient.getJSON("/api/device/usb")
                val chargerData = try { agentClient.getJSON("/api/device/charger") } catch (_: Exception) { null }
                val status = DeviceParser.parseUSBStatus(usbData, chargerData)
                _state.value = _state.value.copy(usbStatus = status, isLoading = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) refresh() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun setMode(mode: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null, showModeSheet = false)
            try {
                agentClient.putJSON("/api/device/usb/mode", mapOf("mode" to mode))
                _state.value = _state.value.copy(message = "USB mode set to $mode", messageIsError = false)
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) setMode(mode) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun togglePowerbank(enabled: Boolean) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.putJSON("/api/device/powerbank", mapOf(
                    "otg_powerbank_state" to if (enabled) "1" else "0",
                ))
                _state.value = _state.value.copy(message = "Powerbank ${if (enabled) "enabled" else "disabled"}", messageIsError = false)
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) togglePowerbank(enabled) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun showModeSheet() { _state.value = _state.value.copy(showModeSheet = true) }
    fun hideModeSheet() { _state.value = _state.value.copy(showModeSheet = false) }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
