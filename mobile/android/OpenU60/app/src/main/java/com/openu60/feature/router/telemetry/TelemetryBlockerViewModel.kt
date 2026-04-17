package com.openu60.feature.router.telemetry

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.DomainFilterConfig
import com.openu60.core.model.TelemetryParser
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TelemetryBlockerState(
    val config: DomainFilterConfig = DomainFilterConfig.empty,
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
    val newDomain: String = "",
)

@HiltViewModel
class TelemetryBlockerViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(TelemetryBlockerState())
    val state: StateFlow<TelemetryBlockerState> = _state.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val data = agentClient.getJSON("/api/router/domain-filter")
                val config = TelemetryParser.parseDomainFilter(data)
                _state.value = _state.value.copy(config = config, isLoading = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) refresh() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun toggleFilter(enabled: Boolean) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.putJSON("/api/router/domain-filter", mapOf("domain_filter_enable" to if (enabled) "1" else "0"))
                _state.value = _state.value.copy(message = "Filter ${if (enabled) "enabled" else "disabled"}", messageIsError = false)
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) toggleFilter(enabled) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun updateNewDomain(value: String) {
        _state.value = _state.value.copy(newDomain = value)
    }

    fun addRule(domain: String) {
        if (domain.isBlank()) return
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.putJSON("/api/router/domain-filter", mapOf("domain" to domain, "action" to "add"))
                _state.value = _state.value.copy(newDomain = "", message = "Rule added", messageIsError = false)
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) addRule(domain) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun removeRule(id: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val rule = _state.value.config.rules.find { it.id == id }
                if (rule != null) {
                    agentClient.putJSON("/api/router/domain-filter", mapOf("domain" to rule.domain, "action" to "delete"))
                }
                _state.value = _state.value.copy(message = "Rule removed", messageIsError = false)
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) removeRule(id) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun blockAllTelemetry() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val existing = _state.value.config.rules.map { it.domain }.toSet()
                var added = 0
                for (domain in TelemetryParser.knownTelemetryDomains) {
                    if (domain !in existing) {
                        agentClient.putJSON("/api/router/domain-filter", mapOf("domain" to domain, "action" to "add"))
                        added++
                    }
                }
                _state.value = _state.value.copy(
                    message = if (added > 0) "Blocked $added telemetry domains" else "All telemetry domains already blocked",
                    messageIsError = false,
                )
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) blockAllTelemetry() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
