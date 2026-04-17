package com.openu60.core.crypto

import com.openu60.core.model.ConfigHeader
import com.openu60.core.model.KnownKey
import java.nio.ByteBuffer
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

class ZTEConfigCryptoException(message: String) : Exception(message)

object ZTEConfigCrypto {

    private const val AES_BLOCK_SIZE = 16
    private const val AES_128_KEY_SIZE = 16
    private const val AES_256_KEY_SIZE = 32
    private const val AES_CBC_IV_SIZE = 16

    fun readHeader(data: ByteArray): ConfigHeader {
        if (data.size < ConfigHeader.HEADER_SIZE) {
            throw ZTEConfigCryptoException(
                "File too small (${data.size} bytes) for a valid ZTE config header"
            )
        }
        val magic = String(data, 0, 4, Charsets.US_ASCII)
        if (magic != ConfigHeader.HEADER_MAGIC) {
            throw ZTEConfigCryptoException("Invalid header magic: $magic (expected ${ConfigHeader.HEADER_MAGIC})")
        }
        val payloadType = ByteBuffer.wrap(data, ConfigHeader.PAYLOAD_TYPE_OFFSET, 4).int
        val sigRaw = data.sliceArray(ConfigHeader.SIGNATURE_OFFSET until ConfigHeader.SIGNATURE_OFFSET + ConfigHeader.SIGNATURE_MAX_LEN)
        val sigEnd = sigRaw.indexOf(0)
        val signature = if (sigEnd >= 0) {
            String(sigRaw, 0, sigEnd, Charsets.US_ASCII)
        } else {
            String(sigRaw, Charsets.US_ASCII)
        }
        var payloadOffset = ByteBuffer.wrap(data, ConfigHeader.PAYLOAD_OFFSET_FIELD, 4).int
        if (payloadOffset == 0 || payloadOffset > data.size) {
            payloadOffset = ConfigHeader.HEADER_SIZE
        }
        return ConfigHeader(
            magic = magic,
            payloadType = payloadType,
            signature = signature,
            payloadOffset = payloadOffset,
        )
    }

    fun decryptECB(data: ByteArray, key: ByteArray): ByteArray {
        val adjustedKey = adjustKey(key, AES_128_KEY_SIZE)
        val cipher = Cipher.getInstance("AES/ECB/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(adjustedKey, "AES"))
        val decrypted = cipher.doFinal(data)
        return removePkcs7Padding(decrypted)
    }

    fun encryptECB(data: ByteArray, key: ByteArray): ByteArray {
        val adjustedKey = adjustKey(key, AES_128_KEY_SIZE)
        val padded = addPkcs7Padding(data)
        val cipher = Cipher.getInstance("AES/ECB/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(adjustedKey, "AES"))
        return cipher.doFinal(padded)
    }

    fun decryptCBC(data: ByteArray, key: ByteArray): ByteArray {
        if (data.size < AES_CBC_IV_SIZE + AES_BLOCK_SIZE) {
            throw ZTEConfigCryptoException("Data too short for CBC decryption")
        }
        val adjustedKey = adjustKey(key, AES_256_KEY_SIZE)
        val iv = data.copyOfRange(0, AES_CBC_IV_SIZE)
        val ciphertext = data.copyOfRange(AES_CBC_IV_SIZE, data.size)
        val cipher = Cipher.getInstance("AES/CBC/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(adjustedKey, "AES"), IvParameterSpec(iv))
        val decrypted = cipher.doFinal(ciphertext)
        return removePkcs7Padding(decrypted)
    }

    fun encryptCBC(data: ByteArray, key: ByteArray, iv: ByteArray? = null): ByteArray {
        val adjustedKey = adjustKey(key, AES_256_KEY_SIZE)
        val actualIv = iv ?: ByteArray(AES_CBC_IV_SIZE).also { SecureRandom().nextBytes(it) }
        val padded = addPkcs7Padding(data)
        val cipher = Cipher.getInstance("AES/CBC/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(adjustedKey, "AES"), IvParameterSpec(actualIv))
        return actualIv + cipher.doFinal(padded)
    }

    fun decryptConfig(data: ByteArray, key: ByteArray? = null, serial: String? = null): ByteArray {
        val header = readHeader(data)
        val payload = data.copyOfRange(header.payloadOffset, data.size)

        if (header.payloadType == ConfigHeader.PAYLOAD_TYPE_PLAIN) {
            return try {
                ZTECompression.decompress(payload)
            } catch (_: Exception) {
                payload
            }
        }

        val isCBC = header.payloadType in listOf(ConfigHeader.PAYLOAD_TYPE_CBC, ConfigHeader.PAYLOAD_TYPE_CBC_NEW)

        if (key != null) {
            return tryDecrypt(payload, key, isCBC)
        }

        val sigBytes = header.signature.toByteArray(Charsets.US_ASCII)
        val candidates = KnownKey.getAllKeys(serial = serial, signature = sigBytes)
        var lastError: Exception? = null
        for (candidate in candidates) {
            try {
                return tryDecrypt(payload, candidate.key, isCBC)
            } catch (e: Exception) {
                lastError = e
            }
        }
        throw ZTEConfigCryptoException("Failed to decrypt config with any known key. Last error: ${lastError?.message}")
    }

    fun encryptConfig(
        xmlData: ByteArray,
        key: ByteArray,
        payloadType: Int = ConfigHeader.PAYLOAD_TYPE_ECB,
        signature: String = "",
    ): ByteArray {
        val compressed = ZTECompression.compress(xmlData)
        val encrypted = when (payloadType) {
            ConfigHeader.PAYLOAD_TYPE_CBC, ConfigHeader.PAYLOAD_TYPE_CBC_NEW -> encryptCBC(compressed, key)
            ConfigHeader.PAYLOAD_TYPE_PLAIN -> compressed
            else -> encryptECB(compressed, key)
        }
        val header = buildHeader(payloadType, signature, ConfigHeader.HEADER_SIZE)
        return header + encrypted
    }

    private fun tryDecrypt(payload: ByteArray, key: ByteArray, isCBC: Boolean): ByteArray {
        val decrypted = if (isCBC) decryptCBC(payload, key) else decryptECB(payload, key)
        val result = ZTECompression.decompress(decrypted)
        val trimmed = result.dropWhile { it == ' '.code.toByte() || it == '\n'.code.toByte() || it == '\r'.code.toByte() || it == '\t'.code.toByte() }.toByteArray()
        if (trimmed.isNotEmpty() && trimmed[0] != '<'.code.toByte()) {
            throw ZTEConfigCryptoException("Decrypted data does not appear to be XML")
        }
        return result
    }

    private fun buildHeader(payloadType: Int, signature: String, payloadOffset: Int): ByteArray {
        val header = ByteArray(ConfigHeader.HEADER_SIZE)
        ConfigHeader.HEADER_MAGIC.toByteArray(Charsets.US_ASCII).copyInto(header, 0)
        ByteBuffer.wrap(header, ConfigHeader.PAYLOAD_TYPE_OFFSET, 4).putInt(payloadType)
        val sigBytes = signature.toByteArray(Charsets.US_ASCII)
        val sigLen = minOf(sigBytes.size, ConfigHeader.SIGNATURE_MAX_LEN)
        sigBytes.copyInto(header, ConfigHeader.SIGNATURE_OFFSET, 0, sigLen)
        ByteBuffer.wrap(header, ConfigHeader.PAYLOAD_OFFSET_FIELD, 4).putInt(payloadOffset)
        return header
    }

    private fun adjustKey(key: ByteArray, targetSize: Int): ByteArray {
        return when {
            key.size < targetSize -> key + ByteArray(targetSize - key.size)
            key.size > targetSize -> key.copyOf(targetSize)
            else -> key
        }
    }

    private fun addPkcs7Padding(data: ByteArray): ByteArray {
        val padLen = AES_BLOCK_SIZE - (data.size % AES_BLOCK_SIZE)
        return data + ByteArray(padLen) { padLen.toByte() }
    }

    private fun removePkcs7Padding(data: ByteArray): ByteArray {
        if (data.isEmpty()) return data
        val padLen = data.last().toInt() and 0xFF
        if (padLen in 1..AES_BLOCK_SIZE && data.size >= padLen) {
            val allMatch = data.takeLast(padLen).all { (it.toInt() and 0xFF) == padLen }
            if (allMatch) return data.copyOf(data.size - padLen)
        }
        return data
    }
}
