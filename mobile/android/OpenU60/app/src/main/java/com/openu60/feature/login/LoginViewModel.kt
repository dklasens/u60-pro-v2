package com.openu60.feature.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.network.AuthManager
import com.openu60.core.network.AuthState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authManager: AuthManager,
) : ViewModel() {

    val authState = authManager.authState
    val errorMessage = authManager.errorMessage

    private val _password = MutableStateFlow("")
    val password: StateFlow<String> = _password.asStateFlow()

    private val _gateway = MutableStateFlow(authManager.resolveGateway())
    val gateway: StateFlow<String> = _gateway.asStateFlow()

    fun updatePassword(value: String) {
        _password.value = value
    }

    fun updateGateway(value: String) {
        _gateway.value = value
    }

    fun login() {
        val pw = _password.value
        if (pw.isBlank()) return
        authManager.savedGateway = _gateway.value
        viewModelScope.launch {
            authManager.login(pw)
        }
    }

    val isLoggingIn: Boolean
        get() = authState.value == AuthState.LOGGING_IN
}
