package com.openu60.feature.router.wifi

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.WiFiConfig
import com.openu60.core.model.WiFiParser
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class WiFiSettingsState(
    val config: WiFiConfig = WiFiConfig.empty,
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
)

@HiltViewModel
class WiFiSettingsViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(WiFiSettingsState())
    val state: StateFlow<WiFiSettingsState> = _state.asStateFlow()

    fun updateConfig(config: WiFiConfig) {
        _state.value = _state.value.copy(config = config)
    }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val data = agentClient.getJSON("/api/wifi/settings")
                val config = WiFiParser.parse(data)
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
                    "ssid_2g" to c.ssid2g,
                    "ssid_5g" to c.ssid5g,
                    "key_2g" to c.key2g,
                    "key_5g" to c.key5g,
                    "channel_2g" to c.channel2g,
                    "channel_5g" to c.channel5g,
                    "txpower_2g" to c.txpower2g,
                    "txpower_5g" to c.txpower5g,
                    "encryption_2g" to c.encryption2g,
                    "encryption_5g" to c.encryption5g,
                    "wifi_onoff" to if (c.wifiOnOff) "1" else "0",
                    "hidden_2g" to if (c.hidden2g) "1" else "0",
                    "hidden_5g" to if (c.hidden5g) "1" else "0",
                    "radio2_disabled" to if (c.radio2gDisabled) "1" else "0",
                    "radio5_disabled" to if (c.radio5gDisabled) "1" else "0",
                    "wifi6_switch" to if (c.wifi7Enabled) "1" else "0",
                    "htmode_2g" to c.bandwidth2g,
                    "htmode_5g" to c.bandwidth5g,
                    "country" to c.country,
                    "maxassoc" to c.maxAssoc,
                )
                agentClient.putJSON("/api/wifi/settings", params)
                _state.value = _state.value.copy(isLoading = false, message = "WiFi settings saved", messageIsError = false)
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
