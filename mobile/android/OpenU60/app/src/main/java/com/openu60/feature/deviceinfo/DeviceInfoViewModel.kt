package com.openu60.feature.deviceinfo

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.DeviceIdentity
import com.openu60.core.model.DeviceParser
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DeviceInfoState(
    val identity: DeviceIdentity = DeviceIdentity.empty,
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class DeviceInfoViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(DeviceInfoState())
    val state: StateFlow<DeviceInfoState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                coroutineScope {
                    val simJob = async { try { agentClient.getJSON("/api/sim/info") } catch (_: Exception) { emptyMap() } }
                    val imeiJob = async { try { agentClient.getJSON("/api/device/imei") } catch (_: Exception) { emptyMap() } }
                    val wanJob = async { try { agentClient.getJSON("/api/network/wan") } catch (_: Exception) { emptyMap() } }
                    val wan6Job = async { try { agentClient.getJSON("/api/network/wan6") } catch (_: Exception) { emptyMap() } }
                    val lanJob = async { try { agentClient.getJSON("/api/router/lan") } catch (_: Exception) { emptyMap() } }

                    val identity = DeviceParser.parseIdentity(
                        simInfo = simJob.await(),
                        imeiData = imeiJob.await(),
                        wanStatus = wanJob.await(),
                        wan6Status = wan6Job.await(),
                        lanStatus = lanJob.await(),
                    )
                    _state.value = _state.value.copy(identity = identity, isLoading = false)
                }
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) refresh()
                else _state.value = _state.value.copy(isLoading = false, error = "Session expired")
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message)
            }
        }
    }
}
