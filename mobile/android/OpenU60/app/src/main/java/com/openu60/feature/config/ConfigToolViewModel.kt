package com.openu60.feature.config

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.openu60.core.crypto.ZTEConfigCrypto
import com.openu60.core.crypto.ZTEConfigCryptoException
import com.openu60.core.model.ConfigHeader
import com.openu60.core.model.KnownKey
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

data class ConfigToolState(
    val fileName: String? = null,
    val fileSize: Int = 0,
    val header: ConfigHeader? = null,
    val decryptedXml: String? = null,
    val usedKey: String? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val encryptedOutput: ByteArray? = null,
    val encryptedFileName: String? = null,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ConfigToolState) return false
        return fileName == other.fileName && fileSize == other.fileSize &&
            header == other.header && decryptedXml == other.decryptedXml &&
            usedKey == other.usedKey && isLoading == other.isLoading &&
            error == other.error && encryptedFileName == other.encryptedFileName
    }

    override fun hashCode(): Int = fileName.hashCode()
}

@HiltViewModel
class ConfigToolViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val _state = MutableStateFlow(ConfigToolState())
    val state: StateFlow<ConfigToolState> = _state.asStateFlow()

    private val _serial = MutableStateFlow("")
    val serial: StateFlow<String> = _serial.asStateFlow()

    private val _customKey = MutableStateFlow("")
    val customKey: StateFlow<String> = _customKey.asStateFlow()

    private var rawData: ByteArray? = null

    fun updateSerial(value: String) { _serial.value = value }
    fun updateCustomKey(value: String) { _customKey.value = value }

    fun importFile(uri: Uri) {
        viewModelScope.launch {
            _state.value = ConfigToolState(isLoading = true)
            try {
                val data = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.readBytes()
                        ?: throw ZTEConfigCryptoException("Failed to read file")
                }
                rawData = data
                val fileName = uri.lastPathSegment ?: "config.bin"
                val header = ZTEConfigCrypto.readHeader(data)
                _state.value = ConfigToolState(
                    fileName = fileName,
                    fileSize = data.size,
                    header = header,
                )
            } catch (e: Exception) {
                _state.value = ConfigToolState(error = e.message ?: "Failed to import file")
            }
        }
    }

    fun decrypt() {
        val data = rawData ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null, decryptedXml = null)
            try {
                val customKeyStr = _customKey.value.trim()
                val serialStr = _serial.value.trim()
                val key = if (customKeyStr.isNotEmpty()) customKeyStr.toByteArray(Charsets.US_ASCII) else null

                val decrypted = withContext(Dispatchers.Default) {
                    ZTEConfigCrypto.decryptConfig(data, key = key, serial = serialStr.ifEmpty { null })
                }
                val xml = decrypted.toString(Charsets.UTF_8)
                val usedKeyDesc = if (key != null) "Custom key" else "Auto-detected"
                _state.value = _state.value.copy(
                    decryptedXml = xml,
                    usedKey = usedKeyDesc,
                    isLoading = false,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "Decryption failed: ${e.message}",
                )
            }
        }
    }

    fun encrypt(payloadType: Int = ConfigHeader.PAYLOAD_TYPE_ECB) {
        val xml = _state.value.decryptedXml ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null, encryptedOutput = null)
            try {
                val keyStr = _customKey.value.trim()
                val key = if (keyStr.isNotEmpty()) {
                    keyStr.toByteArray(Charsets.US_ASCII)
                } else {
                    KnownKey.KNOWN_KEYS.first().key
                }
                val sig = _state.value.header?.signature ?: ""
                val encrypted = withContext(Dispatchers.Default) {
                    ZTEConfigCrypto.encryptConfig(
                        xml.toByteArray(Charsets.UTF_8),
                        key = key,
                        payloadType = payloadType,
                        signature = sig,
                    )
                }
                _state.value = _state.value.copy(
                    encryptedOutput = encrypted,
                    encryptedFileName = "config_encrypted.bin",
                    isLoading = false,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "Encryption failed: ${e.message}",
                )
            }
        }
    }

    fun exportEncrypted(uri: Uri) {
        val data = _state.value.encryptedOutput ?: return
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    context.contentResolver.openOutputStream(uri)?.use { it.write(data) }
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = "Export failed: ${e.message}")
            }
        }
    }

    fun clear() {
        rawData = null
        _state.value = ConfigToolState()
        _serial.value = ""
        _customKey.value = ""
    }
}
