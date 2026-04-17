package com.openu60.feature.router.mobilenetwork

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.MobileNetworkConfig
import com.openu60.core.model.MobileNetworkParser
import com.openu60.core.model.NetworkOperator
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MobileNetworkState(
    val config: MobileNetworkConfig = MobileNetworkConfig.empty,
    val isLoading: Boolean = false,
    val isScanning: Boolean = false,
    val airplaneModeEnabled: Boolean = false,
    val showRebootAfterAirplaneOff: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
)

@HiltViewModel
class MobileNetworkViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(MobileNetworkState())
    val state: StateFlow<MobileNetworkState> = _state.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val wwanDeferred = async { agentClient.getJSON("/api/modem/data") }
                val signalDeferred = async { agentClient.getJSON("/api/network/signal") }
                val wwanData = wwanDeferred.await()
                val signalData = signalDeferred.await()
                val wwan = MobileNetworkParser.parseWWAN(wwanData)
                val netSelectMode = MobileNetworkParser.parseNetInfo(signalData)
                _state.value = _state.value.copy(
                    config = MobileNetworkConfig(
                        connectMode = wwan.connectMode,
                        roamEnable = wwan.roamEnable,
                        dataEnabled = wwan.dataEnabled,
                        connectStatus = wwan.connectStatus,
                        netSelectMode = netSelectMode,
                    ),
                    isLoading = false,
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) refresh() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun setMobileData(enabled: Boolean) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val params = mapOf("enable" to if (enabled) 1 else 0)
                agentClient.putJSON("/api/modem/data", params)
                repeat(3) {
                    delay(2000)
                    try {
                        val data = agentClient.getJSON("/api/modem/data")
                        val wwan = MobileNetworkParser.parseWWAN(data)
                        if (wwan.dataEnabled == (if (enabled) 1 else 0)) {
                            _state.value = _state.value.copy(
                                config = _state.value.config.copy(dataEnabled = wwan.dataEnabled, connectStatus = wwan.connectStatus),
                                isLoading = false,
                                message = if (enabled) "Mobile data enabled" else "Mobile data disabled",
                                messageIsError = false,
                            )
                            return@launch
                        }
                    } catch (_: Exception) {}
                }
                _state.value = _state.value.copy(isLoading = false, message = "Data toggle sent, status may take a moment to update", messageIsError = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) setMobileData(enabled) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun setAirplaneMode(enabled: Boolean) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null, showRebootAfterAirplaneOff = false)
            val path = if (enabled) "/api/modem/airplane" else "/api/modem/online"
            var success = false
            for (attempt in 1..2) {
                try {
                    agentClient.postJSON(path)
                    success = true
                    break
                } catch (_: Exception) {
                    if (attempt < 2) delay(3000)
                }
            }
            if (success) {
                _state.value = _state.value.copy(
                    airplaneModeEnabled = enabled,
                    isLoading = false,
                    message = if (enabled) "Airplane mode enabled" else "Airplane mode disabled",
                    messageIsError = false,
                )
            } else {
                _state.value = _state.value.copy(
                    isLoading = false,
                    message = "Airplane mode toggle failed. A reboot may be required.",
                    messageIsError = true,
                    showRebootAfterAirplaneOff = !enabled,
                )
            }
        }
    }

    fun scanNetworks() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isScanning = true, message = null)
            try {
                agentClient.postJSON("/api/modem/scan")
                repeat(30) {
                    delay(2000)
                    try {
                        val data = agentClient.getJSON("/api/modem/scan/results")
                        val status = MobileNetworkParser.parseScanStatus(data)
                        if (status == "complete" || status == "done") {
                            val operators = MobileNetworkParser.parseScanResults(data)
                            _state.value = _state.value.copy(
                                config = _state.value.config.copy(operators = operators, scanStatus = status),
                                isScanning = false,
                                message = "Found ${operators.size} networks",
                                messageIsError = false,
                            )
                            return@launch
                        }
                    } catch (_: Exception) {}
                }
                _state.value = _state.value.copy(isScanning = false, message = "Network scan timed out", messageIsError = true)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) scanNetworks() else {
                    _state.value = _state.value.copy(isScanning = false)
                    setError(e.message)
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(isScanning = false)
                setError(e.message)
            }
        }
    }

    fun registerNetwork(operator: NetworkOperator) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val params = mapOf("mcc_mnc" to operator.mccMnc, "rat" to operator.rat)
                agentClient.postJSON("/api/modem/register", params)
                repeat(15) {
                    delay(2000)
                    try {
                        val data = agentClient.getJSON("/api/modem/register/result")
                        val result = MobileNetworkParser.parseRegisterResult(data)
                        if (result.isNotEmpty()) {
                            _state.value = _state.value.copy(
                                isLoading = false,
                                message = "Registered to ${operator.name}",
                                messageIsError = false,
                            )
                            return@launch
                        }
                    } catch (_: Exception) {}
                }
                _state.value = _state.value.copy(isLoading = false, message = "Registration timed out", messageIsError = true)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) registerNetwork(operator) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
