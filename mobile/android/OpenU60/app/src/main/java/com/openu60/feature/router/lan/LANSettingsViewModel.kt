package com.openu60.feature.router.lan

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.LANConfig
import com.openu60.core.model.LANParser
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LANSettingsState(
    val config: LANConfig = LANConfig.empty,
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
)

@HiltViewModel
class LANSettingsViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(LANSettingsState())
    val state: StateFlow<LANSettingsState> = _state.asStateFlow()

    fun updateConfig(config: LANConfig) {
        _state.value = _state.value.copy(config = config)
    }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val data = agentClient.getJSON("/api/router/lan")
                val config = LANParser.parse(data)
                _state.value = _state.value.copy(config = config, isLoading = false)
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
                    "lan_ipaddr" to c.lanIP,
                    "lan_netmask" to c.netmask,
                    "dhcp_enable" to if (c.dhcpEnabled) "1" else "0",
                    "dhcp_start" to c.dhcpStart,
                    "dhcp_end" to c.dhcpEnd,
                    "dhcp_lease_time" to c.dhcpLeaseTime,
                )
                agentClient.putJSON("/api/router/lan", params)
                _state.value = _state.value.copy(isLoading = false, message = "LAN settings saved", messageIsError = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) save() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
