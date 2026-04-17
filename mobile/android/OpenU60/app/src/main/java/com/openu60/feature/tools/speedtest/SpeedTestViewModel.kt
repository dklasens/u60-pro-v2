package com.openu60.feature.tools.speedtest

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SpeedTestServerInfo(
    val id: Int,
    val name: String,
    val country: String,
    val sponsor: String,
)

data class SpeedTestState(
    val servers: List<SpeedTestServerInfo> = emptyList(),
    val selectedServerId: Int? = null,
    val phase: String = "idle",
    val progress: Int = 0,
    val liveSpeedMbps: Double = 0.0,
    val pingMs: Double? = null,
    val jitterMs: Double? = null,
    val downloadMbps: Double? = null,
    val uploadMbps: Double? = null,
    val downloadBytes: Long = 0,
    val uploadBytes: Long = 0,
    val serverName: String = "",
    val error: String? = null,
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
)

@HiltViewModel
class SpeedTestViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(SpeedTestState())
    val state: StateFlow<SpeedTestState> = _state.asStateFlow()

    fun loadServers() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val list = agentClient.getJSONArray("/api/speedtest/servers")
                val servers = list.mapNotNull { map ->
                    val id = (map["id"] as? Number)?.toInt() ?: return@mapNotNull null
                    val name = map["name"] as? String ?: ""
                    val country = map["country"] as? String ?: ""
                    val sponsor = map["sponsor"] as? String ?: ""
                    SpeedTestServerInfo(id, name, country, sponsor)
                }
                _state.value = _state.value.copy(
                    servers = servers,
                    selectedServerId = _state.value.selectedServerId ?: servers.firstOrNull()?.id,
                    isLoading = false,
                )
            } catch (e: AgentError.Unauthorized) {
                authManager.reauthenticate()
                setError("Session expired — please try again")
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun selectServer(id: Int) {
        _state.value = _state.value.copy(selectedServerId = id)
    }

    fun startTest() {
        val serverId = _state.value.selectedServerId ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(
                isLoading = true,
                message = null,
                progress = 0,
                liveSpeedMbps = 0.0,
                pingMs = null,
                jitterMs = null,
                downloadMbps = null,
                uploadMbps = null,
                downloadBytes = 0,
                uploadBytes = 0,
                error = null,
            )
            try {
                agentClient.postJSON("/api/speedtest/start", mapOf("server_id" to serverId))
                _state.value = _state.value.copy(isLoading = false)
                // Poll until done (max 5 minutes)
                var pollCount = 0
                while (pollCount < 300) {
                    pollCount++
                    delay(1000)
                    val data = agentClient.getJSON("/api/speedtest/progress")
                    val phase = data["phase"] as? String ?: "idle"
                    val progress = (data["progress"] as? Number)?.toInt() ?: 0
                    val liveSpeed = (data["live_speed_mbps"] as? Number)?.toDouble() ?: 0.0
                    val ping = (data["ping_ms"] as? Number)?.toDouble()
                    val jitter = (data["jitter_ms"] as? Number)?.toDouble()
                    val download = (data["download_mbps"] as? Number)?.toDouble()
                    val upload = (data["upload_mbps"] as? Number)?.toDouble()
                    val dlBytes = (data["download_bytes"] as? Number)?.toLong() ?: 0L
                    val ulBytes = (data["upload_bytes"] as? Number)?.toLong() ?: 0L
                    val serverName = data["server"] as? String ?: ""
                    val errorMsg = data["error"] as? String

                    _state.value = _state.value.copy(
                        phase = phase,
                        progress = progress,
                        liveSpeedMbps = liveSpeed,
                        pingMs = ping,
                        jitterMs = jitter,
                        downloadMbps = download,
                        uploadMbps = upload,
                        downloadBytes = dlBytes,
                        uploadBytes = ulBytes,
                        serverName = serverName,
                        error = errorMsg,
                    )

                    if (phase in listOf("complete", "cancelled", "error")) break
                }
                if (pollCount >= 300) {
                    setError("Speed test timed out")
                    return@launch
                }
                val finalPhase = _state.value.phase
                _state.value = _state.value.copy(
                    isLoading = false,
                    message = when (finalPhase) {
                        "complete" -> "Speed test complete"
                        "cancelled" -> "Speed test cancelled"
                        "error" -> _state.value.error ?: "Speed test failed"
                        else -> null
                    },
                    messageIsError = finalPhase == "error",
                )
            } catch (e: AgentError.Unauthorized) {
                authManager.reauthenticate()
                setError("Session expired — please try again")
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun stopTest() {
        viewModelScope.launch {
            try {
                agentClient.postJSON("/api/speedtest/stop")
            } catch (e: AgentError.Unauthorized) {
                authManager.reauthenticate()
                setError("Session expired — please try again")
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(
            isLoading = false,
            phase = "idle",
            message = msg ?: "Unknown error",
            messageIsError = true,
        )
    }
}
