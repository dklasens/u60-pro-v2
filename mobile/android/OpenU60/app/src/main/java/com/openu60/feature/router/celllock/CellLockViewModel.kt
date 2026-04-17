package com.openu60.feature.router.celllock

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.CellLockParser
import com.openu60.core.model.CellLockStatus
import com.openu60.core.model.NeighborCell
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

data class CellLockState(
    val status: CellLockStatus = CellLockStatus.empty,
    val neighbors: List<NeighborCell> = emptyList(),
    val isLoading: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
    val nrPCI: String = "",
    val nrEARFCN: String = "",
    val nrBand: String = "",
    val ltePCI: String = "",
    val lteEARFCN: String = "",
)

@HiltViewModel
class CellLockViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(CellLockState())
    val state: StateFlow<CellLockState> = _state.asStateFlow()

    fun updateField(field: String, value: String) {
        _state.value = when (field) {
            "nrPCI" -> _state.value.copy(nrPCI = value)
            "nrEARFCN" -> _state.value.copy(nrEARFCN = value)
            "nrBand" -> _state.value.copy(nrBand = value)
            "ltePCI" -> _state.value.copy(ltePCI = value)
            "lteEARFCN" -> _state.value.copy(lteEARFCN = value)
            else -> _state.value
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val data = agentClient.getJSON("/api/modem/cell-lock")
                val status = CellLockParser.parse(data)
                _state.value = _state.value.copy(status = status, isLoading = false)
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) refresh() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun lockNRCell() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val s = _state.value
                val params = mapOf(
                    "lock_nr_pci" to s.nrPCI,
                    "lock_nr_earfcn" to s.nrEARFCN,
                    "lock_nr_cell_band" to s.nrBand
                )
                agentClient.postJSON("/api/cell/lock/nr", params)
                _state.value = _state.value.copy(
                    isLoading = false,
                    message = "NR Cell lock applied",
                    messageIsError = false,
                )
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) lockNRCell() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun lockLTECell() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                val s = _state.value
                val params = mapOf(
                    "lock_lte_pci" to s.ltePCI,
                    "lock_lte_earfcn" to s.lteEARFCN
                )
                agentClient.postJSON("/api/cell/lock/lte", params)
                _state.value = _state.value.copy(
                    isLoading = false,
                    message = "LTE Cell lock applied",
                    messageIsError = false,
                )
                refresh()
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) lockLTECell() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun resetCellLock() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/cell/lock/reset")
                _state.value = _state.value.copy(
                    status = CellLockStatus.empty,
                    isLoading = false,
                    message = "Cell lock removed",
                    messageIsError = false,
                    nrPCI = "", nrEARFCN = "", nrBand = "",
                    ltePCI = "", lteEARFCN = "",
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) resetCellLock() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    fun scanNeighbors() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, message = null)
            try {
                agentClient.postJSON("/api/cell/neighbors/scan")
                delay(3000)
                val dataNr = try { agentClient.getJSON("/api/cell/neighbors/nr") } catch (_: Exception) { emptyMap() }
                val dataLte = try { agentClient.getJSON("/api/cell/neighbors/lte") } catch (_: Exception) { emptyMap() }
                
                val neighborsNr = CellLockParser.parseNeighbors(dataNr, "NR")
                val neighborsLte = CellLockParser.parseNeighbors(dataLte, "LTE")
                val neighbors = neighborsNr + neighborsLte

                _state.value = _state.value.copy(
                    neighbors = neighbors,
                    isLoading = false,
                    message = "Found ${neighbors.size} neighbor cells",
                    messageIsError = false,
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) scanNeighbors() else setError(e.message)
            } catch (e: Exception) {
                setError(e.message)
            }
        }
    }

    private fun setError(msg: String?) {
        _state.value = _state.value.copy(isLoading = false, message = msg ?: "Unknown error", messageIsError = true)
    }
}
