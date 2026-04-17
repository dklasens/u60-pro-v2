package com.openu60.feature.router.firewall

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.FirewallConfig
import com.openu60.core.model.FirewallParser
import com.openu60.core.model.PortForwardRule
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FirewallSettingsState(
    val config: FirewallConfig = FirewallConfig.empty,
    val portForwardRules: List<PortForwardRule> = emptyList(),
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
    val showPortForwardForm: Boolean = false,
)

@HiltViewModel
class FirewallSettingsViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(FirewallSettingsState())
    val state: StateFlow<FirewallSettingsState> = _state.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val configData = agentClient.getJSON("/api/router/firewall")
                val config = FirewallParser.parseConfig(configData)

                val pfData = agentClient.getJSON("/api/router/firewall/port-forward")
                val rules = FirewallParser.parsePortForwardRules(pfData)

                _state.value = _state.value.copy(config = config, portForwardRules = rules, isLoading = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) refresh() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun toggleFirewall(enabled: Boolean) = updateConfig(mapOf("firewall_switch" to if (enabled) "1" else "0"))
    fun toggleNAT(enabled: Boolean) = updateConfig(mapOf("nat_switch" to if (enabled) "1" else "0"))
    fun toggleUPnP(enabled: Boolean) = updateConfig(mapOf("upnp_switch" to if (enabled) "1" else "0"))
    fun togglePortForward(enabled: Boolean) = updateConfig(mapOf("port_forward_switch" to if (enabled) "1" else "0"))

    fun setFirewallLevel(level: String) = updateConfig(mapOf("firewall_level" to level))

    fun setDMZ(enabled: Boolean, host: String) = updateConfig(mapOf(
        "dmz_enabled" to if (enabled) "1" else "0",
        "dmz_ip" to host,
    ))

    fun addPortForwardRule(name: String, protocol: String, wanPort: String, lanIP: String, lanPort: String, enabled: Boolean) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/router/firewall/port-forward", mapOf(
                    "name" to name,
                    "protocol" to protocol,
                    "wan_port" to wanPort,
                    "lan_ip" to lanIP,
                    "lan_port" to lanPort,
                    "enabled" to if (enabled) "1" else "0",
                ))
                _state.value = _state.value.copy(
                    showPortForwardForm = false,
                    message = "Rule added",
                    messageIsError = false,
                )
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) addPortForwardRule(name, protocol, wanPort, lanIP, lanPort, enabled)
                else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun deletePortForwardRule(id: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/router/firewall/port-forward/delete", mapOf("id" to id))
                _state.value = _state.value.copy(message = "Rule deleted", messageIsError = false)
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) deletePortForwardRule(id) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun showAddForm() {
        _state.value = _state.value.copy(showPortForwardForm = true)
    }

    fun hideAddForm() {
        _state.value = _state.value.copy(showPortForwardForm = false)
    }

    private fun updateConfig(params: Map<String, Any?>) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.putJSON("/api/router/firewall", params)
                _state.value = _state.value.copy(message = "Settings updated", messageIsError = false)
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) updateConfig(params) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
