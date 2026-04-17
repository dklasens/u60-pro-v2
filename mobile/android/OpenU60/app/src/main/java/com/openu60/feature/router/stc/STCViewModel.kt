package com.openu60.feature.router.stc

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.STCConfig
import com.openu60.core.model.STCParser
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class STCState(
    val config: STCConfig = STCConfig.empty,
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
)

@HiltViewModel
class STCViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(STCState())
    val state: StateFlow<STCState> = _state.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val paramsData = agentClient.getJSON("/api/cell/stc/params")
                var config = STCParser.parseParams(paramsData)

                try {
                    val statusData = agentClient.getJSON("/api/cell/stc/status")
                    config = STCParser.parseStatus(statusData, config)
                } catch (_: Exception) {}

                _state.value = _state.value.copy(config = config, isLoading = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) refresh() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun toggle(enabled: Boolean) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/cell/stc/enable", mapOf("stc_enable" to if (enabled) "1" else "0"))
                _state.value = _state.value.copy(message = "STC ${if (enabled) "enabled" else "disabled"}", messageIsError = false)
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) toggle(enabled) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
