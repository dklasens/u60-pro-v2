package com.openu60.feature.router.dns

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.DNSConfig
import com.openu60.core.model.DNSParser
import com.openu60.core.model.DoHCacheEntry
import com.openu60.core.model.DoHParser
import com.openu60.core.model.DoHStatus
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

enum class DNSMode { AUTO, CUSTOM, DOH }

data class DNSSettingsState(
    val dnsConfig: DNSConfig = DNSConfig.empty,
    val dohStatus: DoHStatus = DoHStatus.empty,
    val cacheEntries: List<DoHCacheEntry> = emptyList(),
    val dnsMode: DNSMode = DNSMode.AUTO,
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
)

@HiltViewModel
class DNSSettingsViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(DNSSettingsState())
    val state: StateFlow<DNSSettingsState> = _state.asStateFlow()

    fun updateDnsConfig(config: DNSConfig) {
        _state.value = _state.value.copy(dnsConfig = config)
    }

    fun setDnsMode(mode: DNSMode) {
        val previousMode = _state.value.dnsMode
        _state.value = _state.value.copy(dnsMode = mode)
        if (previousMode == DNSMode.DOH && mode != DNSMode.DOH && _state.value.dohStatus.enabled) {
            disableDoH()
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val dnsDeferred = async { agentClient.getJSON("/api/router/dns") }
                val dohDeferred = async {
                    try { agentClient.getJSON("/api/doh/status") } catch (_: Exception) { emptyMap() }
                }
                val dnsData = dnsDeferred.await()
                val dohData = dohDeferred.await()
                val dnsConfig = DNSParser.parse(dnsData)
                val dohStatus = if (dohData.isNotEmpty()) DoHParser.parse(dohData) else DoHStatus.empty
                val mode = when {
                    dohStatus.enabled -> DNSMode.DOH
                    dnsConfig.isManual -> DNSMode.CUSTOM
                    else -> DNSMode.AUTO
                }
                _state.value = _state.value.copy(
                    dnsConfig = dnsConfig,
                    dohStatus = dohStatus,
                    dnsMode = mode,
                    isLoading = false,
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) refresh() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun saveDNS() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val c = _state.value.dnsConfig
                val dnsMode = when (_state.value.dnsMode) {
                    DNSMode.AUTO -> "auto"
                    DNSMode.CUSTOM -> "manual"
                    DNSMode.DOH -> "manual"
                }
                val params = mapOf(
                    "dns_mode" to dnsMode,
                    "prefer_dns_manual" to c.primaryDns,
                    "standby_dns_manual" to c.secondaryDns,
                    "ipv6_prefer_dns_manual" to c.ipv6PrimaryDns,
                    "ipv6_standby_dns_manual" to c.ipv6SecondaryDns,
                )
                agentClient.putJSON("/api/router/dns", params)
                _state.value = _state.value.copy(isLoading = false, message = "DNS settings saved", messageIsError = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) saveDNS() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun enableDoH() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/doh/enable")
                _state.value = _state.value.copy(
                    dohStatus = _state.value.dohStatus.copy(enabled = true),
                    isLoading = false,
                    message = "DoH enabled",
                    messageIsError = false,
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) enableDoH() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun disableDoH() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/doh/disable")
                _state.value = _state.value.copy(
                    dohStatus = _state.value.dohStatus.copy(enabled = false),
                    isLoading = false,
                    message = "DoH disabled",
                    messageIsError = false,
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) disableDoH() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun fetchDohCache() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val list = agentClient.getJSONArray("/api/doh/cache")
                val entries = DoHParser.parseCacheEntries(list)
                _state.value = _state.value.copy(cacheEntries = entries, isLoading = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) fetchDohCache() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
