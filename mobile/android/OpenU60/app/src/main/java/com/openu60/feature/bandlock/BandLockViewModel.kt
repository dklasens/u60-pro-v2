package com.openu60.feature.bandlock

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.model.BandConfig
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AgentError
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.math.BigInteger
import javax.inject.Inject

data class BandLockState(
    val selectedNRBands: Set<Int> = emptySet(),
    val selectedLTEBands: Set<Int> = emptySet(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null,
)

@HiltViewModel
class BandLockViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(BandLockState())
    val state: StateFlow<BandLockState> = _state.asStateFlow()

    fun toggleNRBand(band: Int) {
        val current = _state.value.selectedNRBands.toMutableSet()
        if (band in current) current.remove(band) else current.add(band)
        _state.value = _state.value.copy(selectedNRBands = current, successMessage = null)
    }

    fun toggleLTEBand(band: Int) {
        val current = _state.value.selectedLTEBands.toMutableSet()
        if (band in current) current.remove(band) else current.add(band)
        _state.value = _state.value.copy(selectedLTEBands = current, successMessage = null)
    }

    fun applyNRLock() {
        val bands = _state.value.selectedNRBands.sorted().joinToString(",")
        if (bands.isBlank()) return
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null, successMessage = null)
            try {
                agentClient.postJSON("/api/cell/band/nr", mapOf(
                    "nr5g_type" to "SA",
                    "nr5g_band" to bands,
                ))
                _state.value = _state.value.copy(
                    isLoading = false,
                    successMessage = "NR bands locked to: $bands",
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) applyNRLock()
                else _state.value = _state.value.copy(isLoading = false, error = e.message)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun applyLTELock() {
        val selectedBands = _state.value.selectedLTEBands
        if (selectedBands.isEmpty()) return
        
        var mask = BigInteger.ZERO
        for (b in selectedBands) {
            mask = mask.or(BigInteger.ONE.shiftLeft(b - 1))
        }
        val maskStr = mask.toString()
        val bandsDisplay = selectedBands.sorted().joinToString(",")

        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null, successMessage = null)
            try {
                agentClient.postJSON("/api/cell/band/lte", mapOf(
                    "is_lte_band" to "1",
                    "lte_band_mask" to maskStr,
                    "is_gw_band" to "0",
                    "gw_band_mask" to "0",
                ))
                _state.value = _state.value.copy(
                    isLoading = false,
                    successMessage = "LTE bands locked to: $bandsDisplay",
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) applyLTELock()
                else _state.value = _state.value.copy(isLoading = false, error = e.message)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun unlockAll() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null, successMessage = null)
            try {
                agentClient.postJSON("/api/cell/band/reset")
                _state.value = _state.value.copy(
                    isLoading = false,
                    selectedNRBands = emptySet(),
                    selectedLTEBands = emptySet(),
                    successMessage = "All bands unlocked",
                )
            } catch (e: AgentError.Unauthorized) {
                if (authManager.reauthenticate()) unlockAll()
                else _state.value = _state.value.copy(isLoading = false, error = e.message)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message)
            }
        }
    }
}
