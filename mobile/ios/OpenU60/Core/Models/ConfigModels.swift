import Foundation

enum PayloadType: UInt8 {
    case ecb = 0
    case cbc = 1
    case plain = 2
    case cbcNew = 3

    var displayName: String {
        switch self {
        case .ecb: return "AES-128-ECB"
        case .cbc: return "AES-256-CBC"
        case .plain: return "Unencrypted"
        case .cbcNew: return "AES-256-CBC (New)"
        }
    }
}

struct ConfigHeader: Equatable {
    var magic: String = ""
    var payloadType: PayloadType = .ecb
    var signature: String = ""
    var payloadOffset: UInt32 = 128
    var isValid: Bool { magic == "ZXHN" }
}

struct KnownKey: Identifiable, Equatable {
    let id = UUID()
    let description: String
    let keyBytes: Data
}

enum ConfigConstants {
    static let headerMagic = "ZXHN"
    static let headerSize = 128
    static let payloadTypeOffset = 4
    static let signatureOffset = 8
    static let signatureMaxLen = 64
    static let payloadOffsetField = 72
    static let aesBlockSize = 16
    static let aes128KeySize = 16
    static let aes256KeySize = 32
    static let cbcIVSize = 16

    static let knownKeys: [KnownKey] = [
        KnownKey(description: "ZTE default (MIIBIjANB...)", keyBytes: Data("MIIBIjANBgkqhk".utf8)),
        KnownKey(description: "ZTE default 2", keyBytes: Data("Wj".utf8)),
        KnownKey(description: "ZTE ZXHN H298N", keyBytes: Data("ZTE%FN$GponNJ025".utf8)),
        KnownKey(description: "ZTE ZXHN H108N V2.5", keyBytes: Data("GrWM2ans*f@7SSc&".utf8)),
        KnownKey(description: "ZTE ZXHN H168N V3.5", keyBytes: Data([0x47, 0x72, 0x57, 0x4d, 0x33, 0x6d, 0x6e, 0x2f, 0x00, 0x59, 0x3e, 0x2a, 0x66, 0x32, 0x67, 0x55])),
        KnownKey(description: "ZTE ZXHN H298A", keyBytes: Data("m8@96&ah*ZTE%FN!".utf8)),
        KnownKey(description: "ZTE ZXHN F670L", keyBytes: Data("ZTE%FN$GponNJ025".utf8)),
        KnownKey(description: "ZTE MF283+", keyBytes: Data("SDT&*Ssym0722!@#".utf8)),
        KnownKey(description: "ZTE ZXHN F609", keyBytes: Data("'MMI@FP*Jhg&^%$$".utf8)),
        KnownKey(description: "ZTE ZXHN F660", keyBytes: Data("ZTE%FN$GponNJ025".utf8)),
        KnownKey(description: "ZTE ZXHN H267A", keyBytes: Data("GrWM2ans*f@7SSc&".utf8)),
        KnownKey(description: "ZTE generic key 1", keyBytes: Data("402c38de39bed665".utf8)),
        KnownKey(description: "ZTE generic key 2", keyBytes: Data("8cc72b05705d5c46".utf8)),
        KnownKey(description: "ZTE generic key 3", keyBytes: Data("SMGPOINTzteGpon!".utf8)),
    ]
}
