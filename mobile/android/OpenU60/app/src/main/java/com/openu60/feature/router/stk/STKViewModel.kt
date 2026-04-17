package com.openu60.feature.router.stk

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.STKMenu
import com.openu60.core.model.STKMenuItem
import com.openu60.core.model.STKParser
import com.openu60.core.model.USSDResponse
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class STKState(
    val stkMenu: STKMenu = STKMenu.empty,
    val menuStack: List<STKMenu> = emptyList(),
    val ussdCode: String = "",
    val ussdReply: String = "",
    val ussdResponse: USSDResponse = USSDResponse.empty,
    val showUssdResponse: Boolean = false,
    val stkNotSupported: Boolean = false,
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
)

@HiltViewModel
class STKViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(STKState())
    val state: StateFlow<STKState> = _state.asStateFlow()

    fun updateUssdCode(code: String) {
        _state.value = _state.value.copy(ussdCode = code)
    }

    fun updateUssdReply(reply: String) {
        _state.value = _state.value.copy(ussdReply = reply)
    }

    fun loadSTKMenu() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val data = agentClient.getJSON("/api/stk/menu")
                val error = STKParser.parseError(data)
                if (error != null) {
                    _state.value = _state.value.copy(isLoading = false, stkNotSupported = true, message = error, messageIsError = true)
                    return@launch
                }
                val menu = STKParser.parseSTKMenu(data)
                _state.value = _state.value.copy(stkMenu = menu, menuStack = emptyList(), isLoading = false, stkNotSupported = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) loadSTKMenu() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun selectSTKItem(item: STKMenuItem) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val data = agentClient.postJSON("/api/stk/select", mapOf("id" to item.id))
                val resultType = data["type"] as? String ?: ""
                if (resultType == "menu") {
                    val menu = STKParser.parseSTKMenu(data)
                    val stack = _state.value.menuStack + _state.value.stkMenu
                    _state.value = _state.value.copy(stkMenu = menu, menuStack = stack, isLoading = false)
                } else {
                    val display = data["text"] as? String ?: data["display"] as? String ?: "Response received"
                    _state.value = _state.value.copy(isLoading = false, message = display, messageIsError = false)
                }
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) selectSTKItem(item) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun goBackSTK() {
        val stack = _state.value.menuStack
        if (stack.isEmpty()) return
        _state.value = _state.value.copy(
            stkMenu = stack.last(),
            menuStack = stack.dropLast(1),
        )
    }

    fun sendUSSD() {
        val code = _state.value.ussdCode.trim()
        if (code.isBlank()) return
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null, showUssdResponse = false)
            try {
                val data = agentClient.postJSON("/api/ussd/send", mapOf("code" to code))
                val response = STKParser.parseUSSDResponse(data)
                _state.value = _state.value.copy(
                    ussdResponse = response,
                    showUssdResponse = true,
                    isLoading = false,
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) sendUSSD() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun respondUSSD() {
        val reply = _state.value.ussdReply.trim()
        if (reply.isBlank()) return
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val data = agentClient.postJSON("/api/ussd/respond", mapOf("response" to reply))
                val response = STKParser.parseUSSDResponse(data)
                _state.value = _state.value.copy(
                    ussdResponse = response,
                    ussdReply = "",
                    isLoading = false,
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) respondUSSD() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun cancelUSSD() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/ussd/cancel")
                _state.value = _state.value.copy(
                    showUssdResponse = false,
                    ussdResponse = USSDResponse.empty,
                    ussdReply = "",
                    isLoading = false,
                    message = "USSD session cancelled",
                    messageIsError = false,
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) cancelUSSD() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
