package com.openu60.feature.tools.process

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.ProcessInfo
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProcessListState(
    val processes: List<ProcessInfo> = emptyList(),
    val totalCount: Int = 0,
    val bloatCount: Int = 0,
    val bloatCpuPct: Double = 0.0,
    val bloatRssKb: Long = 0,
    val isLoading: Boolean = false,
    val error: String? = null,
    val message: String? = null,
)

@HiltViewModel
class ProcessListViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(ProcessListState())
    val state: StateFlow<ProcessListState> = _state.asStateFlow()

    private var pollingJob: Job? = null

    init {
        startPolling()
    }

    fun refresh() {
        viewModelScope.launch {
            fetchProcesses()
        }
    }

    fun killBloat(pids: List<Int>? = null) {
        viewModelScope.launch {
            try {
                val body = if (pids == null) {
                    mapOf("all" to true)
                } else {
                    mapOf("pids" to pids)
                }
                val bodyStr = buildJsonString(body)
                val data = agentClient.postJSON("/api/system/kill-bloat", body)
                val killedList = data["killed"] as? List<*> ?: emptyList<Any>()
                val freedRssKb = (data["freed_rss_kb"] as? Number)?.toLong() ?: 0
                val freedMB = String.format("%.1f", freedRssKb / 1024.0)
                _state.value = _state.value.copy(
                    message = "Killed ${killedList.size} daemons, freed ${freedMB} MB",
                )
                fetchProcesses()
            } catch (e: AgentError.Unauthorized) {
                authManager.reauthenticate()
                setError("Session expired — please try again")
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun clearMessage() {
        _state.value = _state.value.copy(message = null)
    }

    private fun startPolling() {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (isActive) {
                fetchProcesses()
                delay(3000)
            }
        }
    }

    private suspend fun fetchProcesses() {
        if (_state.value.processes.isEmpty()) {
            _state.value = _state.value.copy(isLoading = true)
        }
        try {
            val data = agentClient.getJSON("/api/system/top")
            val processList = (data["processes"] as? List<*>)?.mapNotNull { item ->
                val map = item as? Map<*, *> ?: return@mapNotNull null
                ProcessInfo(
                    pid = (map["pid"] as? Number)?.toInt() ?: return@mapNotNull null,
                    name = map["name"] as? String ?: "",
                    cpuPct = (map["cpu_pct"] as? Number)?.toDouble() ?: 0.0,
                    rssKb = (map["rss_kb"] as? Number)?.toLong() ?: 0,
                    state = map["state"] as? String ?: "",
                    isBloat = map["is_bloat"] as? Boolean ?: false,
                )
            } ?: emptyList()

            _state.value = _state.value.copy(
                processes = processList,
                totalCount = (data["total_count"] as? Number)?.toInt() ?: processList.size,
                bloatCount = (data["bloat_count"] as? Number)?.toInt() ?: 0,
                bloatCpuPct = (data["bloat_cpu_pct"] as? Number)?.toDouble() ?: 0.0,
                bloatRssKb = (data["bloat_rss_kb"] as? Number)?.toLong() ?: 0,
                isLoading = false,
                error = null,
            )
        } catch (e: AgentError.Unauthorized) {
            authManager.reauthenticate()
            setError("Session expired — please try again")
        } catch (e: Exception) {
            setError(e.message)
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, error = msg ?: "Unknown error")
    }

    private fun buildJsonString(map: Map<String, Any?>): String {
        val entries = map.entries.joinToString(",") { (k, v) ->
            val valStr = when (v) {
                is Boolean -> v.toString()
                is List<*> -> "[${v.joinToString(",") { it.toString() }}]"
                else -> "\"$v\""
            }
            "\"$k\":$valStr"
        }
        return "{$entries}"
    }
}
