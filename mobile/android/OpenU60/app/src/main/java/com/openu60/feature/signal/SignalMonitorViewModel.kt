package com.openu60.feature.signal

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.*
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import com.openu60.core.network.AuthState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SignalMonitorState(
    val nr: NRSignal = NRSignal.empty,
    val lte: LTESignal = LTESignal.empty,
    val wcdma: WCDMASignal = WCDMASignal.empty,
    val operatorInfo: OperatorInfo = OperatorInfo.empty,
    val history: List<SignalSnapshot> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class SignalMonitorViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(SignalMonitorState())
    val state: StateFlow<SignalMonitorState> = _state.asStateFlow()

    val authState = authManager.authState

    private var pollingJob: Job? = null
    private val maxHistory = 60

    init {
        viewModelScope.launch {
            authManager.authState.collect { authState ->
                if (authState == AuthState.LOGGED_IN) {
                    startPolling()
                } else {
                    stopPolling()
                }
            }
        }
    }

    fun refresh() {
        viewModelScope.launch { fetchSignal() }
    }

    private fun startPolling() {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (isActive) {
                fetchSignal()
                delay(authManager.pollInterval * 1000L)
            }
        }
    }

    private fun stopPolling() {
        pollingJob?.cancel()
        pollingJob = null
    }

    private suspend fun fetchSignal() {
        _state.value = _state.value.copy(isLoading = true, error = null)
        try {
            val data = agentClient.getJSON("/api/network/signal")
            val result = SignalParser.parseNetInfo(data)

            val snapshot = SignalSnapshot.create(
                nrRSRP = result.nr.rsrp,
                lteRSRP = result.lte.rsrp,
            )
            val newHistory = (_state.value.history + snapshot).takeLast(maxHistory)

            _state.value = _state.value.copy(
                nr = result.nr,
                lte = result.lte,
                wcdma = result.wcdma,
                operatorInfo = result.operatorInfo,
                history = newHistory,
                isLoading = false,
            )
        } catch (e: AgentError.Unauthorized) {
            if (authManager.reauthenticate()) {
                fetchSignal()
            } else {
                _state.value = _state.value.copy(isLoading = false, error = "Session expired")
            }
        } catch (e: Exception) {
            _state.value = _state.value.copy(isLoading = false, error = e.message)
        }
    }

    override fun onCleared() {
        super.onCleared()
        stopPolling()
    }
}
