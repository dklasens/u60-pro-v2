import Foundation
import Compression

/// ZLIB decompression for ZTE config files.
/// Handles plain ZLIB, chunked ZLIB (4-byte BE length prefix), and raw deflate.
enum ZTECompression {

    /// Decompress ZTE config payload. Tries plain zlib, chunked, then raw deflate.
    static func decompress(_ data: Data) throws -> Data {
        // Try plain zlib first
        if let result = decompressZlib(data) {
            return result
        }

        // Try chunked format
        if let result = decompressChunked(data) {
            return result
        }

        // Try raw deflate
        if let result = decompressRaw(data) {
            return result
        }

        // Try skipping potential garbage header bytes
        for skip in [2, 4, 8, 16] {
            if data.count > skip, let result = decompressZlib(data.dropFirst(skip)) {
                return result
            }
        }

        throw CompressionError.decompressionFailed
    }

    /// Compress data using ZLIB.
    static func compress(_ data: Data, chunked: Bool = false, chunkSize: Int = 65536) throws -> Data {
        if !chunked {
            guard let result = compressZlib(data) else {
                throw CompressionError.compressionFailed
            }
            return result
        }

        var result = Data()
        var offset = 0
        while offset < data.count {
            let end = min(offset + chunkSize, data.count)
            let chunk = data[offset..<end]
            guard let compressed = compressZlib(Data(chunk)) else {
                throw CompressionError.compressionFailed
            }
            var length = UInt32(compressed.count).bigEndian
            result.append(Data(bytes: &length, count: 4))
            result.append(compressed)
            offset = end
        }
        return result
    }

    // MARK: - Internal

    private static func decompressZlib(_ data: Data) -> Data? {
        performDecompression(data, algorithm: COMPRESSION_ZLIB)
    }

    private static func decompressRaw(_ data: Data) -> Data? {
        performDecompression(data, algorithm: COMPRESSION_ZLIB)
    }

    private static func decompressChunked(_ data: Data) -> Data? {
        var result = Data()
        var offset = 0
        var chunksFound = 0

        while offset + 4 <= data.count {
            let lengthData = data[offset..<(offset + 4)]
            let chunkLength = lengthData.withUnsafeBytes { ptr -> UInt32 in
                ptr.load(as: UInt32.self).bigEndian
            }
            offset += 4

            if chunkLength == 0 { break }
            guard chunkLength <= data.count - offset else { return nil }

            let chunkData = data[offset..<(offset + Int(chunkLength))]
            offset += Int(chunkLength)

            guard let decompressed = decompressZlib(Data(chunkData)) else { return nil }
            result.append(decompressed)
            chunksFound += 1
        }

        return chunksFound > 0 ? result : nil
    }

    private static func performDecompression(_ data: Data, algorithm: compression_algorithm) -> Data? {
        let destinationBufferSize = data.count * 10
        let destinationBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: destinationBufferSize)
        defer { destinationBuffer.deallocate() }

        let decompressedSize = data.withUnsafeBytes { sourcePtr -> Int in
            guard let baseAddress = sourcePtr.baseAddress else { return 0 }
            return compression_decode_buffer(
                destinationBuffer, destinationBufferSize,
                baseAddress.assumingMemoryBound(to: UInt8.self), data.count,
                nil, algorithm
            )
        }

        guard decompressedSize > 0 else { return nil }

        // If the buffer was fully used, the data might be larger - try again with bigger buffer
        if decompressedSize == destinationBufferSize {
            let largerSize = destinationBufferSize * 4
            let largerBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: largerSize)
            defer { largerBuffer.deallocate() }

            let size = data.withUnsafeBytes { sourcePtr -> Int in
                guard let baseAddress = sourcePtr.baseAddress else { return 0 }
                return compression_decode_buffer(
                    largerBuffer, largerSize,
                    baseAddress.assumingMemoryBound(to: UInt8.self), data.count,
                    nil, algorithm
                )
            }
            guard size > 0 else { return nil }
            return Data(bytes: largerBuffer, count: size)
        }

        return Data(bytes: destinationBuffer, count: decompressedSize)
    }

    private static func compressZlib(_ data: Data) -> Data? {
        let destinationBufferSize = data.count + 1024
        let destinationBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: destinationBufferSize)
        defer { destinationBuffer.deallocate() }

        let compressedSize = data.withUnsafeBytes { sourcePtr -> Int in
            guard let baseAddress = sourcePtr.baseAddress else { return 0 }
            return compression_encode_buffer(
                destinationBuffer, destinationBufferSize,
                baseAddress.assumingMemoryBound(to: UInt8.self), data.count,
                nil, COMPRESSION_ZLIB
            )
        }

        guard compressedSize > 0 else { return nil }
        return Data(bytes: destinationBuffer, count: compressedSize)
    }

    enum CompressionError: LocalizedError {
        case decompressionFailed
        case compressionFailed

        var errorDescription: String? {
            switch self {
            case .decompressionFailed: return "Failed to decompress data"
            case .compressionFailed: return "Failed to compress data"
            }
        }
    }
}
