package com.openu60.feature.router.vpn

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.VPNPassthroughConfig
import com.openu60.core.model.VPNPassthroughParser
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class VPNPassthroughState(
    val config: VPNPassthroughConfig = VPNPassthroughConfig.empty,
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
)

@HiltViewModel
class VPNPassthroughViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(VPNPassthroughState())
    val state: StateFlow<VPNPassthroughState> = _state.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val data = agentClient.getJSON("/api/router/vpn")
                val config = VPNPassthroughParser.parse(data)
                _state.value = _state.value.copy(config = config, isLoading = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) refresh() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun toggle(field: String, value: Boolean) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.putJSON("/api/router/vpn", mapOf(field to if (value) "1" else "0"))
                _state.value = _state.value.copy(message = "Updated", messageIsError = false)
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) toggle(field, value) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
