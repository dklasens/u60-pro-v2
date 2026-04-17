import UIKit
import CoreImage.CIFilterBuiltins

enum WiFiQRGenerator {
    private static let context = CIContext()

    static func generate(ssid: String, password: String, encryption: String) -> UIImage? {
        let type = mapEncryption(encryption)
        let escaped = "WIFI:T:\(type);S:\(escape(ssid));P:\(escape(password));;"
        guard let data = escaped.data(using: .utf8) else { return nil }

        let filter = CIFilter.qrCodeGenerator()
        filter.message = data
        filter.correctionLevel = "M"

        guard let ciImage = filter.outputImage else { return nil }

        let scale: CGFloat = 10
        let transformed = ciImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        guard let cgImage = context.createCGImage(transformed, from: transformed.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }

    private static func mapEncryption(_ enc: String) -> String {
        let lower = enc.lowercased()
        if lower == "none" { return "nopass" }
        if lower.contains("sae") { return "SAE" }
        return "WPA"
    }

    private static func escape(_ value: String) -> String {
        var result = value
        result = result.replacingOccurrences(of: "\\", with: "\\\\")
        result = result.replacingOccurrences(of: ";", with: "\\;")
        result = result.replacingOccurrences(of: ",", with: "\\,")
        result = result.replacingOccurrences(of: ":", with: "\\:")
        result = result.replacingOccurrences(of: "\"", with: "\\\"")
        return result
    }
}
