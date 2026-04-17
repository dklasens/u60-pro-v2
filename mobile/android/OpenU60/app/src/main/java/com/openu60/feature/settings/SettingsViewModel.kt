package com.openu60.feature.settings

import androidx.lifecycle.ViewModel
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AuthManager
import com.openu60.core.network.AuthState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authManager: AuthManager,
    private val agentClient: AgentClient,
) : ViewModel() {

    val authState = authManager.authState

    private val _gateway = MutableStateFlow(authManager.resolveGateway())
    val gateway: StateFlow<String> = _gateway.asStateFlow()

    private val _pollInterval = MutableStateFlow(authManager.pollInterval)
    val pollInterval: StateFlow<Int> = _pollInterval.asStateFlow()

    private val _darkMode = MutableStateFlow<Boolean?>(authManager.darkMode)
    val darkMode: StateFlow<Boolean?> = _darkMode.asStateFlow()

    fun updateGateway(value: String) {
        _gateway.value = value
        authManager.savedGateway = value
        agentClient.baseURL = authManager.resolveBaseURL()
    }

    fun updatePollInterval(value: Int) {
        _pollInterval.value = value
        authManager.pollInterval = value
    }

    fun toggleDarkMode(enabled: Boolean) {
        _darkMode.value = enabled
        authManager.darkMode = enabled
    }

    fun logout() {
        authManager.logout()
    }

    val isLoggedIn: Boolean
        get() = authManager.authState.value == AuthState.LOGGED_IN
}
