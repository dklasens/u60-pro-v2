package com.openu60.feature.router.networkmode

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.NetworkModeConfig
import com.openu60.core.model.NetworkModeParser
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

data class NetworkModeState(
    val config: NetworkModeConfig = NetworkModeConfig.empty,
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
)

@HiltViewModel
class NetworkModeViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(NetworkModeState())
    val state: StateFlow<NetworkModeState> = _state.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val data = agentClient.getJSON("/api/modem/data")
                val config = NetworkModeParser.parse(data)
                _state.value = _state.value.copy(config = config, isLoading = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) refresh() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun setNetworkMode(value: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.putJSON("/api/modem/network-mode", mapOf("net_select" to value))
                repeat(5) {
                    delay(2000)
                    try {
                        val data = agentClient.getJSON("/api/modem/data")
                        val config = NetworkModeParser.parse(data)
                        if (config.netSelect == value) {
                            _state.value = _state.value.copy(
                                config = config,
                                isLoading = false,
                                message = "Network mode updated",
                                messageIsError = false,
                            )
                            return@launch
                        }
                    } catch (_: Exception) {}
                }
                _state.value = _state.value.copy(
                    config = _state.value.config.copy(netSelect = value),
                    isLoading = false,
                    message = "Mode change sent",
                    messageIsError = false,
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) setNetworkMode(value) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
