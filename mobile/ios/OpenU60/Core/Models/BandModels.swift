import Foundation

struct BandConfig: Equatable {
    var nrBands: Set<String> = []
    var lteBands: Set<String> = []

    static let empty = BandConfig()

    static let commonNRBands = ["1", "2", "3", "5", "7", "8", "12", "20", "25", "28", "38", "40", "41", "48", "66", "71", "77", "78", "79"]
    static let commonLTEBands = ["1", "2", "3", "4", "5", "7", "8", "12", "13", "14", "17", "20", "25", "26", "28", "29", "30", "32", "38", "39", "40", "41", "42", "43", "46", "48", "66", "71"]

    var nrBandString: String {
        nrBands.sorted { (Int($0) ?? 0) < (Int($1) ?? 0) }.joined(separator: ",")
    }

    var lteBandString: String {
        lteBands.sorted { (Int($0) ?? 0) < (Int($1) ?? 0) }.joined(separator: ",")
    }

    // MARK: - Frequency Lookup

    static func lteFrequency(band: String) -> String? {
        BandSpecDatabase.lte(band)?.commonName
    }

    static func nrFrequency(band: String) -> String? {
        BandSpecDatabase.nr(band)?.commonName
    }
}
