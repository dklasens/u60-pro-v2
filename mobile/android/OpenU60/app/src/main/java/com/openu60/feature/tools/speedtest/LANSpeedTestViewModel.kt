package com.openu60.feature.tools.speedtest

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AuthManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okio.Buffer
import java.util.concurrent.TimeUnit
import javax.inject.Inject

data class LANSpeedTestState(
    val phase: String = "idle",
    val progress: Float = 0f,
    val liveSpeedMbps: Double = 0.0,
    val pingMs: Double? = null,
    val downloadMbps: Double? = null,
    val uploadMbps: Double? = null,
    val error: String? = null,
    val isRunning: Boolean = false,
)

@HiltViewModel
class LANSpeedTestViewModel @Inject constructor(
    private val agentClient: AgentClient,
    private val authManager: AuthManager,
) : ViewModel() {

    private val _state = MutableStateFlow(LANSpeedTestState())
    val state: StateFlow<LANSpeedTestState> = _state.asStateFlow()

    private var testJob: Job? = null

    private val testSize = 20_000_000

    private val lanClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .build()

    fun startTest() {
        if (_state.value.isRunning) return
        _state.value = LANSpeedTestState(isRunning = true)

        testJob = viewModelScope.launch {
            try {
                // Ping
                _state.value = _state.value.copy(phase = "ping")
                val ping = measurePing()
                _state.value = _state.value.copy(pingMs = ping, progress = 0.2f)

                // Download
                _state.value = _state.value.copy(phase = "download", liveSpeedMbps = 0.0)
                val download = measureDownload()
                _state.value = _state.value.copy(downloadMbps = download, progress = 0.6f)

                // Upload
                _state.value = _state.value.copy(phase = "upload", liveSpeedMbps = 0.0)
                val upload = measureUpload()
                _state.value = _state.value.copy(
                    uploadMbps = upload,
                    progress = 1f,
                    phase = "complete",
                    isRunning = false,
                    liveSpeedMbps = 0.0,
                )
            } catch (e: kotlinx.coroutines.CancellationException) {
                _state.value = _state.value.copy(phase = "cancelled", isRunning = false, liveSpeedMbps = 0.0)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    phase = "error",
                    error = e.message ?: "Unknown error",
                    isRunning = false,
                    liveSpeedMbps = 0.0,
                )
            }
        }
    }

    fun stopTest() {
        testJob?.cancel()
        testJob = null
    }

    private suspend fun measurePing(): Double = withContext(Dispatchers.IO) {
        val url = "${agentClient.baseURL}/api/lan/ping"
        val rtts = mutableListOf<Double>()

        repeat(10) {
            if (!isActive) throw kotlinx.coroutines.CancellationException()
            val request = Request.Builder()
                .url(url)
                .get()
                .apply { agentClient.token?.let { header("Authorization", "Bearer $it") } }
                .build()

            val start = System.nanoTime()
            lanClient.newCall(request).execute().use { response ->
                response.body?.string()
            }
            val rtt = (System.nanoTime() - start) / 1_000_000.0
            rtts.add(rtt)
        }

        rtts.sort()
        rtts[rtts.size / 2]
    }

    private suspend fun measureDownload(): Double = withContext(Dispatchers.IO) {
        val url = "${agentClient.baseURL}/api/lan/download?size=$testSize"
        val request = Request.Builder()
            .url(url)
            .get()
            .apply { agentClient.token?.let { header("Authorization", "Bearer $it") } }
            .build()

        val response = lanClient.newCall(request).execute()
        val source = response.body!!.source()
        val buf = Buffer()
        var received = 0L
        val start = System.nanoTime()

        while (isActive) {
            val read = source.read(buf, 16384)
            if (read == -1L) break
            received += read
            buf.clear()

            val elapsed = (System.nanoTime() - start) / 1_000_000_000.0
            if (elapsed > 0.1) {
                val mbps = received * 8.0 / (elapsed * 1_000_000)
                val fraction = received.toDouble() / testSize
                _state.value = _state.value.copy(
                    liveSpeedMbps = mbps,
                    progress = (0.2f + fraction.toFloat() * 0.4f).coerceAtMost(0.6f),
                )
            }
        }
        response.close()

        val elapsed = (System.nanoTime() - start) / 1_000_000_000.0
        if (elapsed > 0) received * 8.0 / (elapsed * 1_000_000) else 0.0
    }

    private suspend fun measureUpload(): Double = withContext(Dispatchers.IO) {
        val url = "${agentClient.baseURL}/api/lan/upload"
        val uploadData = ByteArray(testSize)
        val body = uploadData.toRequestBody("application/octet-stream".toMediaType())

        val request = Request.Builder()
            .url(url)
            .post(body)
            .apply { agentClient.token?.let { header("Authorization", "Bearer $it") } }
            .build()

        val start = System.nanoTime()
        val response = lanClient.newCall(request).execute()
        val elapsed = (System.nanoTime() - start) / 1_000_000_000.0
        val responseBody = response.body?.string() ?: ""
        response.close()

        // Parse server-measured result
        try {
            val element = Json.parseToJsonElement(responseBody)
            val data = element.jsonObject["data"]?.jsonObject
            val serverMbps = data?.get("mbps")?.jsonPrimitive?.doubleOrNull
            if (serverMbps != null) return@withContext serverMbps
        } catch (_: Exception) {}

        // Fallback to client-side
        if (elapsed > 0) testSize * 8.0 / (elapsed * 1_000_000) else 0.0
    }
}
