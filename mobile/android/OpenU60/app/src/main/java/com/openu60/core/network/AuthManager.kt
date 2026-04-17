package com.openu60.core.network

import android.content.Context
import android.net.wifi.WifiManager
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

enum class AuthState {
    LOGGED_OUT,
    LOGGING_IN,
    LOGGED_IN,
    ERROR,
}

@Singleton
class AuthManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val agentClient: AgentClient,
) {
    private val _authState = MutableStateFlow(AuthState.LOGGED_OUT)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val securePrefs = EncryptedSharedPreferences.create(
        context,
        "zte_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    val prefs = context.getSharedPreferences("zte_prefs", Context.MODE_PRIVATE)

    var savedGateway: String
        get() = prefs.getString("gateway", "") ?: ""
        set(value) = prefs.edit().putString("gateway", value).apply()

    var savedPassword: String
        get() = securePrefs.getString("password", "") ?: ""
        set(value) = securePrefs.edit().putString("password", value).apply()

    var pollInterval: Int
        get() = prefs.getInt("poll_interval", 3)
        set(value) = prefs.edit().putInt("poll_interval", value).apply()

    var darkMode: Boolean
        get() = prefs.getBoolean("dark_mode", true)
        set(value) = prefs.edit().putBoolean("dark_mode", value).apply()

    fun detectGateway(): String {
        try {
            @Suppress("DEPRECATION")
            val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            val dhcpInfo = wifiManager?.dhcpInfo
            if (dhcpInfo != null && dhcpInfo.gateway != 0) {
                val gw = dhcpInfo.gateway
                return "${gw and 0xFF}.${(gw shr 8) and 0xFF}.${(gw shr 16) and 0xFF}.${(gw shr 24) and 0xFF}"
            }
        } catch (_: Exception) {}
        return "192.168.0.1"
    }

    fun resolveGateway(): String {
        val saved = savedGateway
        return if (saved.isNotBlank()) saved else detectGateway()
    }

    fun resolveBaseURL(): String = "http://${resolveGateway()}:9090"

    suspend fun login(password: String): Result<String> {
        _authState.value = AuthState.LOGGING_IN
        _errorMessage.value = null
        agentClient.baseURL = resolveBaseURL()
        return try {
            val token = agentClient.login(password)
            _authState.value = AuthState.LOGGED_IN
            savedPassword = password
            Result.success(token)
        } catch (e: AgentError) {
            _authState.value = AuthState.ERROR
            _errorMessage.value = when (e) {
                is AgentError.Unauthorized -> "Invalid password"
                is AgentError.ServerUnreachable -> "Cannot reach agent — is it running on port 9090?"
                is AgentError.Timeout -> "Connection timed out"
                is AgentError.NetworkError -> "Connection failed: ${e.message}"
                else -> e.message
            }
            Result.failure(e)
        } catch (e: Exception) {
            _authState.value = AuthState.ERROR
            _errorMessage.value = "Unexpected error: ${e.message}"
            Result.failure(e)
        }
    }

    suspend fun autoLogin(): Boolean {
        val password = savedPassword
        if (password.isBlank()) return false
        return login(password).isSuccess
    }

    suspend fun reauthenticate(): Boolean {
        val password = savedPassword
        if (password.isBlank()) return false
        agentClient.baseURL = resolveBaseURL()
        return try {
            agentClient.login(password)
            _authState.value = AuthState.LOGGED_IN
            true
        } catch (_: Exception) {
            false
        }
    }

    fun logout() {
        agentClient.token = null
        _authState.value = AuthState.LOGGED_OUT
        _errorMessage.value = null
    }
}
