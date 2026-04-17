import Foundation

// MARK: - Types

enum DuplexMode: String {
    case fdd = "FDD"
    case tdd = "TDD"
    case sdl = "SDL"
    case sul = "SUL"
}

enum FrequencyRange: String {
    case fr1 = "FR1"
    case fr2 = "FR2"
}

enum BandTechnology {
    case nr, lte

    func spec(for band: String) -> BandSpec? {
        switch self {
        case .nr: return BandSpecDatabase.nr(band)
        case .lte: return BandSpecDatabase.lte(band)
        }
    }
}

struct BandSpec {
    let band: Int
    let commonName: String
    let dlRange: String
    let ulRange: String
    let maxBandwidthMHz: Int
    let duplexMode: DuplexMode
    let frequencyRange: FrequencyRange
}

// MARK: - Database

enum BandSpecDatabase {

    // MARK: LTE Bands (3GPP TS 36.101)

    static let lteBands: [Int: BandSpec] = [
        1:  BandSpec(band: 1,  commonName: "2100 MHz",        dlRange: "2110–2170",     ulRange: "1920–1980",     maxBandwidthMHz: 20,  duplexMode: .fdd, frequencyRange: .fr1),
        2:  BandSpec(band: 2,  commonName: "1900 MHz",        dlRange: "1930–1990",     ulRange: "1850–1910",     maxBandwidthMHz: 20,  duplexMode: .fdd, frequencyRange: .fr1),
        3:  BandSpec(band: 3,  commonName: "1800 MHz",        dlRange: "1805–1880",     ulRange: "1710–1785",     maxBandwidthMHz: 20,  duplexMode: .fdd, frequencyRange: .fr1),
        4:  BandSpec(band: 4,  commonName: "AWS-1",           dlRange: "2110–2155",     ulRange: "1710–1755",     maxBandwidthMHz: 20,  duplexMode: .fdd, frequencyRange: .fr1),
        5:  BandSpec(band: 5,  commonName: "850 MHz",         dlRange: "869–894",       ulRange: "824–849",       maxBandwidthMHz: 10,  duplexMode: .fdd, frequencyRange: .fr1),
        7:  BandSpec(band: 7,  commonName: "2600 MHz",        dlRange: "2620–2690",     ulRange: "2500–2570",     maxBandwidthMHz: 20,  duplexMode: .fdd, frequencyRange: .fr1),
        8:  BandSpec(band: 8,  commonName: "900 MHz",         dlRange: "925–960",       ulRange: "880–915",       maxBandwidthMHz: 10,  duplexMode: .fdd, frequencyRange: .fr1),
        11: BandSpec(band: 11, commonName: "1500 MHz",        dlRange: "1475.9–1495.9", ulRange: "1427.9–1447.9", maxBandwidthMHz: 10,  duplexMode: .fdd, frequencyRange: .fr1),
        12: BandSpec(band: 12, commonName: "700 MHz",         dlRange: "729–746",       ulRange: "699–716",       maxBandwidthMHz: 10,  duplexMode: .fdd, frequencyRange: .fr1),
        13: BandSpec(band: 13, commonName: "700 MHz",         dlRange: "746–756",       ulRange: "777–787",       maxBandwidthMHz: 10,  duplexMode: .fdd, frequencyRange: .fr1),
        14: BandSpec(band: 14, commonName: "700 MHz (PS)",    dlRange: "758–768",       ulRange: "788–798",       maxBandwidthMHz: 10,  duplexMode: .fdd, frequencyRange: .fr1),
        17: BandSpec(band: 17, commonName: "700 MHz",         dlRange: "734–746",       ulRange: "704–716",       maxBandwidthMHz: 10,  duplexMode: .fdd, frequencyRange: .fr1),
        18: BandSpec(band: 18, commonName: "850 MHz",         dlRange: "860–875",       ulRange: "815–830",       maxBandwidthMHz: 15,  duplexMode: .fdd, frequencyRange: .fr1),
        19: BandSpec(band: 19, commonName: "850 MHz",         dlRange: "875–890",       ulRange: "830–845",       maxBandwidthMHz: 15,  duplexMode: .fdd, frequencyRange: .fr1),
        20: BandSpec(band: 20, commonName: "800 MHz",         dlRange: "791–821",       ulRange: "832–862",       maxBandwidthMHz: 20,  duplexMode: .fdd, frequencyRange: .fr1),
        21: BandSpec(band: 21, commonName: "1500 MHz",        dlRange: "1495.9–1510.9", ulRange: "1447.9–1462.9", maxBandwidthMHz: 15,  duplexMode: .fdd, frequencyRange: .fr1),
        25: BandSpec(band: 25, commonName: "1900 MHz",        dlRange: "1930–1995",     ulRange: "1850–1915",     maxBandwidthMHz: 20,  duplexMode: .fdd, frequencyRange: .fr1),
        26: BandSpec(band: 26, commonName: "850 MHz",         dlRange: "859–894",       ulRange: "814–849",       maxBandwidthMHz: 15,  duplexMode: .fdd, frequencyRange: .fr1),
        28: BandSpec(band: 28, commonName: "700 MHz",         dlRange: "758–803",       ulRange: "703–748",       maxBandwidthMHz: 20,  duplexMode: .fdd, frequencyRange: .fr1),
        29: BandSpec(band: 29, commonName: "700 MHz",         dlRange: "717–728",       ulRange: "",              maxBandwidthMHz: 10,  duplexMode: .sdl, frequencyRange: .fr1),
        30: BandSpec(band: 30, commonName: "2300 MHz",        dlRange: "2350–2360",     ulRange: "2305–2315",     maxBandwidthMHz: 10,  duplexMode: .fdd, frequencyRange: .fr1),
        31: BandSpec(band: 31, commonName: "450 MHz",         dlRange: "462.5–467.5",   ulRange: "452.5–457.5",   maxBandwidthMHz: 5,   duplexMode: .fdd, frequencyRange: .fr1),
        32: BandSpec(band: 32, commonName: "1500 MHz",        dlRange: "1452–1496",     ulRange: "",              maxBandwidthMHz: 20,  duplexMode: .sdl, frequencyRange: .fr1),
        34: BandSpec(band: 34, commonName: "2000 MHz",        dlRange: "2010–2025",     ulRange: "2010–2025",     maxBandwidthMHz: 15,  duplexMode: .tdd, frequencyRange: .fr1),
        38: BandSpec(band: 38, commonName: "2600 MHz",        dlRange: "2570–2620",     ulRange: "2570–2620",     maxBandwidthMHz: 20,  duplexMode: .tdd, frequencyRange: .fr1),
        39: BandSpec(band: 39, commonName: "1900 MHz",        dlRange: "1880–1920",     ulRange: "1880–1920",     maxBandwidthMHz: 20,  duplexMode: .tdd, frequencyRange: .fr1),
        40: BandSpec(band: 40, commonName: "2300 MHz",        dlRange: "2300–2400",     ulRange: "2300–2400",     maxBandwidthMHz: 20,  duplexMode: .tdd, frequencyRange: .fr1),
        41: BandSpec(band: 41, commonName: "2500 MHz",        dlRange: "2496–2690",     ulRange: "2496–2690",     maxBandwidthMHz: 20,  duplexMode: .tdd, frequencyRange: .fr1),
        42: BandSpec(band: 42, commonName: "3500 MHz",        dlRange: "3400–3600",     ulRange: "3400–3600",     maxBandwidthMHz: 20,  duplexMode: .tdd, frequencyRange: .fr1),
        43: BandSpec(band: 43, commonName: "3700 MHz",        dlRange: "3600–3800",     ulRange: "3600–3800",     maxBandwidthMHz: 20,  duplexMode: .tdd, frequencyRange: .fr1),
        46: BandSpec(band: 46, commonName: "5200 MHz (LAA)",  dlRange: "5150–5925",     ulRange: "5150–5925",     maxBandwidthMHz: 20,  duplexMode: .tdd, frequencyRange: .fr1),
        48: BandSpec(band: 48, commonName: "3500 MHz (CBRS)", dlRange: "3550–3700",     ulRange: "3550–3700",     maxBandwidthMHz: 20,  duplexMode: .tdd, frequencyRange: .fr1),
        50: BandSpec(band: 50, commonName: "1500 MHz",        dlRange: "1432–1517",     ulRange: "1432–1517",     maxBandwidthMHz: 20,  duplexMode: .tdd, frequencyRange: .fr1),
        51: BandSpec(band: 51, commonName: "1500 MHz",        dlRange: "1427–1432",     ulRange: "1427–1432",     maxBandwidthMHz: 5,   duplexMode: .tdd, frequencyRange: .fr1),
        53: BandSpec(band: 53, commonName: "2400 MHz",        dlRange: "2483.5–2495",   ulRange: "2483.5–2495",   maxBandwidthMHz: 10,  duplexMode: .tdd, frequencyRange: .fr1),
        65: BandSpec(band: 65, commonName: "2100 MHz",        dlRange: "2110–2200",     ulRange: "1920–2010",     maxBandwidthMHz: 20,  duplexMode: .fdd, frequencyRange: .fr1),
        66: BandSpec(band: 66, commonName: "AWS-3",           dlRange: "2110–2200",     ulRange: "1710–1780",     maxBandwidthMHz: 20,  duplexMode: .fdd, frequencyRange: .fr1),
        70: BandSpec(band: 70, commonName: "AWS-4",           dlRange: "1995–2020",     ulRange: "1695–1710",     maxBandwidthMHz: 15,  duplexMode: .fdd, frequencyRange: .fr1),
        71: BandSpec(band: 71, commonName: "600 MHz",         dlRange: "617–652",       ulRange: "663–698",       maxBandwidthMHz: 20,  duplexMode: .fdd, frequencyRange: .fr1),
        72: BandSpec(band: 72, commonName: "450 MHz",         dlRange: "461–466",       ulRange: "451–456",       maxBandwidthMHz: 5,   duplexMode: .fdd, frequencyRange: .fr1),
        73: BandSpec(band: 73, commonName: "450 MHz",         dlRange: "460–465",       ulRange: "450–455",       maxBandwidthMHz: 5,   duplexMode: .fdd, frequencyRange: .fr1),
        74: BandSpec(band: 74, commonName: "1500 MHz",        dlRange: "1475–1518",     ulRange: "1427–1470",     maxBandwidthMHz: 20,  duplexMode: .fdd, frequencyRange: .fr1),
        75: BandSpec(band: 75, commonName: "1500 MHz",        dlRange: "1432–1517",     ulRange: "",              maxBandwidthMHz: 20,  duplexMode: .sdl, frequencyRange: .fr1),
        85: BandSpec(band: 85, commonName: "700 MHz",         dlRange: "728–746",       ulRange: "698–716",       maxBandwidthMHz: 10,  duplexMode: .fdd, frequencyRange: .fr1),
    ]

    // MARK: NR Bands (3GPP TS 38.101)

    static let nrBands: [Int: BandSpec] = [
        // FR1
        1:   BandSpec(band: 1,   commonName: "2100 MHz",        dlRange: "2110–2170",     ulRange: "1920–1980",     maxBandwidthMHz: 50,   duplexMode: .fdd, frequencyRange: .fr1),
        2:   BandSpec(band: 2,   commonName: "1900 MHz",        dlRange: "1930–1990",     ulRange: "1850–1910",     maxBandwidthMHz: 20,   duplexMode: .fdd, frequencyRange: .fr1),
        3:   BandSpec(band: 3,   commonName: "1800 MHz",        dlRange: "1805–1880",     ulRange: "1710–1785",     maxBandwidthMHz: 50,   duplexMode: .fdd, frequencyRange: .fr1),
        5:   BandSpec(band: 5,   commonName: "850 MHz",         dlRange: "869–894",       ulRange: "824–849",       maxBandwidthMHz: 20,   duplexMode: .fdd, frequencyRange: .fr1),
        7:   BandSpec(band: 7,   commonName: "2600 MHz",        dlRange: "2620–2690",     ulRange: "2500–2570",     maxBandwidthMHz: 50,   duplexMode: .fdd, frequencyRange: .fr1),
        8:   BandSpec(band: 8,   commonName: "900 MHz",         dlRange: "925–960",       ulRange: "880–915",       maxBandwidthMHz: 20,   duplexMode: .fdd, frequencyRange: .fr1),
        12:  BandSpec(band: 12,  commonName: "700 MHz",         dlRange: "729–746",       ulRange: "699–716",       maxBandwidthMHz: 15,   duplexMode: .fdd, frequencyRange: .fr1),
        13:  BandSpec(band: 13,  commonName: "700 MHz",         dlRange: "746–756",       ulRange: "777–787",       maxBandwidthMHz: 10,   duplexMode: .fdd, frequencyRange: .fr1),
        14:  BandSpec(band: 14,  commonName: "700 MHz (PS)",    dlRange: "758–768",       ulRange: "788–798",       maxBandwidthMHz: 10,   duplexMode: .fdd, frequencyRange: .fr1),
        18:  BandSpec(band: 18,  commonName: "850 MHz",         dlRange: "860–875",       ulRange: "815–830",       maxBandwidthMHz: 15,   duplexMode: .fdd, frequencyRange: .fr1),
        20:  BandSpec(band: 20,  commonName: "800 MHz",         dlRange: "791–821",       ulRange: "832–862",       maxBandwidthMHz: 20,   duplexMode: .fdd, frequencyRange: .fr1),
        25:  BandSpec(band: 25,  commonName: "1900 MHz",        dlRange: "1930–1995",     ulRange: "1850–1915",     maxBandwidthMHz: 40,   duplexMode: .fdd, frequencyRange: .fr1),
        26:  BandSpec(band: 26,  commonName: "850 MHz",         dlRange: "859–894",       ulRange: "814–849",       maxBandwidthMHz: 20,   duplexMode: .fdd, frequencyRange: .fr1),
        28:  BandSpec(band: 28,  commonName: "700 MHz",         dlRange: "758–803",       ulRange: "703–748",       maxBandwidthMHz: 30,   duplexMode: .fdd, frequencyRange: .fr1),
        29:  BandSpec(band: 29,  commonName: "700 MHz",         dlRange: "717–728",       ulRange: "",              maxBandwidthMHz: 10,   duplexMode: .sdl, frequencyRange: .fr1),
        30:  BandSpec(band: 30,  commonName: "2300 MHz",        dlRange: "2350–2360",     ulRange: "2305–2315",     maxBandwidthMHz: 10,   duplexMode: .fdd, frequencyRange: .fr1),
        34:  BandSpec(band: 34,  commonName: "2000 MHz",        dlRange: "2010–2025",     ulRange: "2010–2025",     maxBandwidthMHz: 15,   duplexMode: .tdd, frequencyRange: .fr1),
        38:  BandSpec(band: 38,  commonName: "2600 MHz",        dlRange: "2570–2620",     ulRange: "2570–2620",     maxBandwidthMHz: 40,   duplexMode: .tdd, frequencyRange: .fr1),
        39:  BandSpec(band: 39,  commonName: "1900 MHz",        dlRange: "1880–1920",     ulRange: "1880–1920",     maxBandwidthMHz: 40,   duplexMode: .tdd, frequencyRange: .fr1),
        40:  BandSpec(band: 40,  commonName: "2300 MHz",        dlRange: "2300–2400",     ulRange: "2300–2400",     maxBandwidthMHz: 50,   duplexMode: .tdd, frequencyRange: .fr1),
        41:  BandSpec(band: 41,  commonName: "2500 MHz",        dlRange: "2496–2690",     ulRange: "2496–2690",     maxBandwidthMHz: 100,  duplexMode: .tdd, frequencyRange: .fr1),
        46:  BandSpec(band: 46,  commonName: "5200 MHz (LAA)",  dlRange: "5150–5925",     ulRange: "5150–5925",     maxBandwidthMHz: 100,  duplexMode: .tdd, frequencyRange: .fr1),
        48:  BandSpec(band: 48,  commonName: "3500 MHz (CBRS)", dlRange: "3550–3700",     ulRange: "3550–3700",     maxBandwidthMHz: 100,  duplexMode: .tdd, frequencyRange: .fr1),
        50:  BandSpec(band: 50,  commonName: "1500 MHz",        dlRange: "1432–1517",     ulRange: "1432–1517",     maxBandwidthMHz: 80,   duplexMode: .tdd, frequencyRange: .fr1),
        51:  BandSpec(band: 51,  commonName: "1500 MHz",        dlRange: "1427–1432",     ulRange: "1427–1432",     maxBandwidthMHz: 5,    duplexMode: .tdd, frequencyRange: .fr1),
        53:  BandSpec(band: 53,  commonName: "2400 MHz",        dlRange: "2483.5–2495",   ulRange: "2483.5–2495",   maxBandwidthMHz: 10,   duplexMode: .tdd, frequencyRange: .fr1),
        65:  BandSpec(band: 65,  commonName: "2100 MHz",        dlRange: "2110–2200",     ulRange: "1920–2010",     maxBandwidthMHz: 50,   duplexMode: .fdd, frequencyRange: .fr1),
        66:  BandSpec(band: 66,  commonName: "AWS-3",           dlRange: "2110–2200",     ulRange: "1710–1780",     maxBandwidthMHz: 40,   duplexMode: .fdd, frequencyRange: .fr1),
        70:  BandSpec(band: 70,  commonName: "AWS-4",           dlRange: "1995–2020",     ulRange: "1695–1710",     maxBandwidthMHz: 25,   duplexMode: .fdd, frequencyRange: .fr1),
        71:  BandSpec(band: 71,  commonName: "600 MHz",         dlRange: "617–652",       ulRange: "663–698",       maxBandwidthMHz: 35,   duplexMode: .fdd, frequencyRange: .fr1),
        74:  BandSpec(band: 74,  commonName: "1500 MHz",        dlRange: "1475–1518",     ulRange: "1427–1470",     maxBandwidthMHz: 20,   duplexMode: .fdd, frequencyRange: .fr1),
        77:  BandSpec(band: 77,  commonName: "3700 MHz",        dlRange: "3300–4200",     ulRange: "3300–4200",     maxBandwidthMHz: 100,  duplexMode: .tdd, frequencyRange: .fr1),
        78:  BandSpec(band: 78,  commonName: "3500 MHz",        dlRange: "3300–3800",     ulRange: "3300–3800",     maxBandwidthMHz: 100,  duplexMode: .tdd, frequencyRange: .fr1),
        79:  BandSpec(band: 79,  commonName: "4700 MHz",        dlRange: "4400–5000",     ulRange: "4400–5000",     maxBandwidthMHz: 100,  duplexMode: .tdd, frequencyRange: .fr1),
        // FR2
        257: BandSpec(band: 257, commonName: "28 GHz",          dlRange: "26500–29500",   ulRange: "26500–29500",   maxBandwidthMHz: 400,  duplexMode: .tdd, frequencyRange: .fr2),
        258: BandSpec(band: 258, commonName: "26 GHz",          dlRange: "24250–27500",   ulRange: "24250–27500",   maxBandwidthMHz: 400,  duplexMode: .tdd, frequencyRange: .fr2),
        260: BandSpec(band: 260, commonName: "39 GHz",          dlRange: "37000–40000",   ulRange: "37000–40000",   maxBandwidthMHz: 400,  duplexMode: .tdd, frequencyRange: .fr2),
        261: BandSpec(band: 261, commonName: "28 GHz",          dlRange: "27500–28350",   ulRange: "27500–28350",   maxBandwidthMHz: 400,  duplexMode: .tdd, frequencyRange: .fr2),
    ]

    // MARK: Lookup

    static func lte(_ band: String) -> BandSpec? {
        guard let num = Int(band) else { return nil }
        return lteBands[num]
    }

    static func nr(_ band: String) -> BandSpec? {
        guard let num = Int(band) else { return nil }
        return nrBands[num]
    }
}
