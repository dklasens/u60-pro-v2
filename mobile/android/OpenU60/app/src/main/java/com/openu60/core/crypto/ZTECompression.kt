package com.openu60.core.crypto

import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.util.zip.Deflater
import java.util.zip.Inflater

object ZTECompression {

    fun decompress(data: ByteArray): ByteArray {
        // Try plain zlib first
        tryPlainZlib(data)?.let { return it }

        // Try chunked format: repeated [4-byte BE length][zlib data]
        tryChunkedZlib(data)?.let { return it }

        // Try raw deflate (no zlib header)
        tryRawDeflate(data)?.let { return it }

        // Try skipping header bytes
        for (skip in listOf(2, 4, 8, 16)) {
            if (data.size > skip) {
                tryPlainZlib(data.copyOfRange(skip, data.size))?.let { return it }
            }
        }

        throw ZTEConfigCryptoException("Failed to decompress data: not valid ZLIB or chunked ZLIB format")
    }

    fun compress(data: ByteArray, chunked: Boolean = false, chunkSize: Int = 65536): ByteArray {
        if (!chunked) {
            return plainCompress(data)
        }
        val output = ByteArrayOutputStream()
        var offset = 0
        while (offset < data.size) {
            val end = minOf(offset + chunkSize, data.size)
            val chunk = data.copyOfRange(offset, end)
            offset = end
            val compressed = plainCompress(chunk)
            val lenBuf = ByteBuffer.allocate(4)
            lenBuf.putInt(compressed.size)
            output.write(lenBuf.array())
            output.write(compressed)
        }
        return output.toByteArray()
    }

    private fun plainCompress(data: ByteArray): ByteArray {
        val deflater = Deflater()
        deflater.setInput(data)
        deflater.finish()
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        while (!deflater.finished()) {
            val count = deflater.deflate(buffer)
            output.write(buffer, 0, count)
        }
        deflater.end()
        return output.toByteArray()
    }

    private fun tryPlainZlib(data: ByteArray): ByteArray? {
        return try {
            val inflater = Inflater()
            inflater.setInput(data)
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            while (!inflater.finished()) {
                val count = inflater.inflate(buffer)
                if (count == 0 && inflater.needsInput()) break
                output.write(buffer, 0, count)
            }
            inflater.end()
            val result = output.toByteArray()
            if (result.isEmpty()) null else result
        } catch (_: Exception) {
            null
        }
    }

    private fun tryRawDeflate(data: ByteArray): ByteArray? {
        return try {
            val inflater = Inflater(true)
            inflater.setInput(data)
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            while (!inflater.finished()) {
                val count = inflater.inflate(buffer)
                if (count == 0 && inflater.needsInput()) break
                output.write(buffer, 0, count)
            }
            inflater.end()
            val result = output.toByteArray()
            if (result.isEmpty()) null else result
        } catch (_: Exception) {
            null
        }
    }

    private fun tryChunkedZlib(data: ByteArray): ByteArray? {
        return try {
            val result = ByteArrayOutputStream()
            var offset = 0
            var chunksFound = 0
            while (offset < data.size) {
                if (offset + 4 > data.size) break
                val chunkLen = ByteBuffer.wrap(data, offset, 4).int
                offset += 4
                if (chunkLen == 0) break
                if (chunkLen < 0 || chunkLen > data.size - offset) {
                    throw Exception("Invalid chunk length")
                }
                val chunk = data.copyOfRange(offset, offset + chunkLen)
                offset += chunkLen
                val decompressed = tryPlainZlib(chunk) ?: tryRawDeflate(chunk)
                    ?: throw Exception("Failed to decompress chunk")
                result.write(decompressed)
                chunksFound++
            }
            if (chunksFound == 0) null else result.toByteArray()
        } catch (_: Exception) {
            null
        }
    }
}
