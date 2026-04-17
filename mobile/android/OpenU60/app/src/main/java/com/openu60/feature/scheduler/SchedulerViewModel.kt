package com.openu60.feature.scheduler

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.ActionTemplate
import com.openu60.core.model.DeviceParser
import com.openu60.core.model.SchedulerJob
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SchedulerState(
    val jobs: List<SchedulerJob> = emptyList(),
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
)

@HiltViewModel
class SchedulerViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(SchedulerState())
    val state: StateFlow<SchedulerState> = _state.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val data = agentClient.getJSON("/api/scheduler/jobs")
                val jobsList = data["jobs"] as? List<*> ?: emptyList<Any>()
                val jobs = jobsList.mapNotNull { item ->
                    val map = item as? Map<*, *> ?: return@mapNotNull null
                    @Suppress("UNCHECKED_CAST")
                    SchedulerJob.parse(map as Map<String, Any?>)
                }
                _state.value = _state.value.copy(jobs = jobs, isLoading = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) refresh() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun toggleJob(id: Int, enabled: Boolean) {
        viewModelScope.launch {
            _state.value = _state.value.copy(message = null)
            try {
                agentClient.putJSON("/api/scheduler/jobs/$id", mapOf("enabled" to enabled))
                _state.value = _state.value.copy(
                    jobs = _state.value.jobs.map { if (it.id == id) it.copy(enabled = enabled) else it },
                    message = "Job ${if (enabled) "enabled" else "disabled"}",
                    messageIsError = false,
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) toggleJob(id, enabled) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun deleteJob(id: Int) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.deleteJSON("/api/scheduler/jobs/$id")
                _state.value = _state.value.copy(message = "Job deleted", messageIsError = false)
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) deleteJob(id) else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun createJob(
        name: String,
        template: ActionTemplate,
        scheduleType: String,
        scheduleTime: String?,
        scheduleDays: List<Int>,
        scheduleAt: Long?,
        restoreTime: String?,
    ) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val schedule = mutableMapOf<String, Any?>("type" to scheduleType)
                if (scheduleType == "recurring") {
                    schedule["time"] = scheduleTime
                    schedule["days"] = scheduleDays
                } else {
                    schedule["at"] = scheduleAt
                }

                val action = mapOf("method" to template.method, "path" to template.path)
                val body = template.actionBody

                val params = mutableMapOf<String, Any?>(
                    "name" to name,
                    "schedule" to schedule,
                    "action" to action,
                )
                if (body != null) params["action_body"] = body
                if (restoreTime != null && template.supportsRestore) {
                    params["restore"] = mapOf("time" to restoreTime, "body" to template.restoreBody)
                }

                agentClient.postJSON("/api/scheduler/jobs", params)
                _state.value = _state.value.copy(message = "Job created", messageIsError = false)
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) createJob(name, template, scheduleType, scheduleTime, scheduleDays, scheduleAt, restoreTime)
                else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
