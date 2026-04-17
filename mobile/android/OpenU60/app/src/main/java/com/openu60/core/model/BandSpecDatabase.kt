package com.openu60.core.model

enum class DuplexMode { FDD, TDD, SDL, SUL }
enum class FrequencyRange { FR1, FR2 }

data class BandSpec(
    val band: Int,
    val commonName: String,
    val dlRange: String,
    val ulRange: String,
    val maxBandwidthMHz: Int,
    val duplexMode: DuplexMode,
    val frequencyRange: FrequencyRange,
)

object BandSpecDatabase {

    val lteBands: Map<Int, BandSpec> = mapOf(
        1 to BandSpec(1, "2100 MHz", "2110-2170", "1920-1980", 20, DuplexMode.FDD, FrequencyRange.FR1),
        2 to BandSpec(2, "1900 MHz", "1930-1990", "1850-1910", 20, DuplexMode.FDD, FrequencyRange.FR1),
        3 to BandSpec(3, "1800 MHz", "1805-1880", "1710-1785", 20, DuplexMode.FDD, FrequencyRange.FR1),
        4 to BandSpec(4, "AWS-1", "2110-2155", "1710-1755", 20, DuplexMode.FDD, FrequencyRange.FR1),
        5 to BandSpec(5, "850 MHz", "869-894", "824-849", 10, DuplexMode.FDD, FrequencyRange.FR1),
        7 to BandSpec(7, "2600 MHz", "2620-2690", "2500-2570", 20, DuplexMode.FDD, FrequencyRange.FR1),
        8 to BandSpec(8, "900 MHz", "925-960", "880-915", 10, DuplexMode.FDD, FrequencyRange.FR1),
        11 to BandSpec(11, "1500 MHz", "1475.9-1495.9", "1427.9-1447.9", 10, DuplexMode.FDD, FrequencyRange.FR1),
        12 to BandSpec(12, "700 MHz", "729-746", "699-716", 10, DuplexMode.FDD, FrequencyRange.FR1),
        13 to BandSpec(13, "700 MHz", "746-756", "777-787", 10, DuplexMode.FDD, FrequencyRange.FR1),
        14 to BandSpec(14, "700 MHz (PS)", "758-768", "788-798", 10, DuplexMode.FDD, FrequencyRange.FR1),
        17 to BandSpec(17, "700 MHz", "734-746", "704-716", 10, DuplexMode.FDD, FrequencyRange.FR1),
        18 to BandSpec(18, "850 MHz", "860-875", "815-830", 15, DuplexMode.FDD, FrequencyRange.FR1),
        19 to BandSpec(19, "850 MHz", "875-890", "830-845", 15, DuplexMode.FDD, FrequencyRange.FR1),
        20 to BandSpec(20, "800 MHz", "791-821", "832-862", 20, DuplexMode.FDD, FrequencyRange.FR1),
        21 to BandSpec(21, "1500 MHz", "1495.9-1510.9", "1447.9-1462.9", 15, DuplexMode.FDD, FrequencyRange.FR1),
        25 to BandSpec(25, "1900 MHz", "1930-1995", "1850-1915", 20, DuplexMode.FDD, FrequencyRange.FR1),
        26 to BandSpec(26, "850 MHz", "859-894", "814-849", 15, DuplexMode.FDD, FrequencyRange.FR1),
        28 to BandSpec(28, "700 MHz", "758-803", "703-748", 20, DuplexMode.FDD, FrequencyRange.FR1),
        29 to BandSpec(29, "700 MHz", "717-728", "", 10, DuplexMode.SDL, FrequencyRange.FR1),
        30 to BandSpec(30, "2300 MHz", "2350-2360", "2305-2315", 10, DuplexMode.FDD, FrequencyRange.FR1),
        31 to BandSpec(31, "450 MHz", "462.5-467.5", "452.5-457.5", 5, DuplexMode.FDD, FrequencyRange.FR1),
        32 to BandSpec(32, "1500 MHz", "1452-1496", "", 20, DuplexMode.SDL, FrequencyRange.FR1),
        34 to BandSpec(34, "2000 MHz", "2010-2025", "2010-2025", 15, DuplexMode.TDD, FrequencyRange.FR1),
        38 to BandSpec(38, "2600 MHz", "2570-2620", "2570-2620", 20, DuplexMode.TDD, FrequencyRange.FR1),
        39 to BandSpec(39, "1900 MHz", "1880-1920", "1880-1920", 20, DuplexMode.TDD, FrequencyRange.FR1),
        40 to BandSpec(40, "2300 MHz", "2300-2400", "2300-2400", 20, DuplexMode.TDD, FrequencyRange.FR1),
        41 to BandSpec(41, "2500 MHz", "2496-2690", "2496-2690", 20, DuplexMode.TDD, FrequencyRange.FR1),
        42 to BandSpec(42, "3500 MHz", "3400-3600", "3400-3600", 20, DuplexMode.TDD, FrequencyRange.FR1),
        43 to BandSpec(43, "3700 MHz", "3600-3800", "3600-3800", 20, DuplexMode.TDD, FrequencyRange.FR1),
        46 to BandSpec(46, "5200 MHz (LAA)", "5150-5925", "5150-5925", 20, DuplexMode.TDD, FrequencyRange.FR1),
        48 to BandSpec(48, "3500 MHz (CBRS)", "3550-3700", "3550-3700", 20, DuplexMode.TDD, FrequencyRange.FR1),
        65 to BandSpec(65, "2100 MHz", "2110-2200", "1920-2010", 20, DuplexMode.FDD, FrequencyRange.FR1),
        66 to BandSpec(66, "AWS-3", "2110-2200", "1710-1780", 20, DuplexMode.FDD, FrequencyRange.FR1),
        70 to BandSpec(70, "AWS-4", "1995-2020", "1695-1710", 15, DuplexMode.FDD, FrequencyRange.FR1),
        71 to BandSpec(71, "600 MHz", "617-652", "663-698", 20, DuplexMode.FDD, FrequencyRange.FR1),
        74 to BandSpec(74, "1500 MHz", "1475-1518", "1427-1470", 20, DuplexMode.FDD, FrequencyRange.FR1),
        85 to BandSpec(85, "700 MHz", "728-746", "698-716", 10, DuplexMode.FDD, FrequencyRange.FR1),
    )

    val nrBands: Map<Int, BandSpec> = mapOf(
        1 to BandSpec(1, "2100 MHz", "2110-2170", "1920-1980", 50, DuplexMode.FDD, FrequencyRange.FR1),
        2 to BandSpec(2, "1900 MHz", "1930-1990", "1850-1910", 20, DuplexMode.FDD, FrequencyRange.FR1),
        3 to BandSpec(3, "1800 MHz", "1805-1880", "1710-1785", 50, DuplexMode.FDD, FrequencyRange.FR1),
        5 to BandSpec(5, "850 MHz", "869-894", "824-849", 20, DuplexMode.FDD, FrequencyRange.FR1),
        7 to BandSpec(7, "2600 MHz", "2620-2690", "2500-2570", 50, DuplexMode.FDD, FrequencyRange.FR1),
        8 to BandSpec(8, "900 MHz", "925-960", "880-915", 20, DuplexMode.FDD, FrequencyRange.FR1),
        12 to BandSpec(12, "700 MHz", "729-746", "699-716", 15, DuplexMode.FDD, FrequencyRange.FR1),
        13 to BandSpec(13, "700 MHz", "746-756", "777-787", 10, DuplexMode.FDD, FrequencyRange.FR1),
        14 to BandSpec(14, "700 MHz (PS)", "758-768", "788-798", 10, DuplexMode.FDD, FrequencyRange.FR1),
        18 to BandSpec(18, "850 MHz", "860-875", "815-830", 15, DuplexMode.FDD, FrequencyRange.FR1),
        20 to BandSpec(20, "800 MHz", "791-821", "832-862", 20, DuplexMode.FDD, FrequencyRange.FR1),
        25 to BandSpec(25, "1900 MHz", "1930-1995", "1850-1915", 40, DuplexMode.FDD, FrequencyRange.FR1),
        26 to BandSpec(26, "850 MHz", "859-894", "814-849", 20, DuplexMode.FDD, FrequencyRange.FR1),
        28 to BandSpec(28, "700 MHz", "758-803", "703-748", 30, DuplexMode.FDD, FrequencyRange.FR1),
        29 to BandSpec(29, "700 MHz", "717-728", "", 10, DuplexMode.SDL, FrequencyRange.FR1),
        30 to BandSpec(30, "2300 MHz", "2350-2360", "2305-2315", 10, DuplexMode.FDD, FrequencyRange.FR1),
        34 to BandSpec(34, "2000 MHz", "2010-2025", "2010-2025", 15, DuplexMode.TDD, FrequencyRange.FR1),
        38 to BandSpec(38, "2600 MHz", "2570-2620", "2570-2620", 40, DuplexMode.TDD, FrequencyRange.FR1),
        39 to BandSpec(39, "1900 MHz", "1880-1920", "1880-1920", 40, DuplexMode.TDD, FrequencyRange.FR1),
        40 to BandSpec(40, "2300 MHz", "2300-2400", "2300-2400", 50, DuplexMode.TDD, FrequencyRange.FR1),
        41 to BandSpec(41, "2500 MHz", "2496-2690", "2496-2690", 100, DuplexMode.TDD, FrequencyRange.FR1),
        46 to BandSpec(46, "5200 MHz (LAA)", "5150-5925", "5150-5925", 100, DuplexMode.TDD, FrequencyRange.FR1),
        48 to BandSpec(48, "3500 MHz (CBRS)", "3550-3700", "3550-3700", 100, DuplexMode.TDD, FrequencyRange.FR1),
        65 to BandSpec(65, "2100 MHz", "2110-2200", "1920-2010", 50, DuplexMode.FDD, FrequencyRange.FR1),
        66 to BandSpec(66, "AWS-3", "2110-2200", "1710-1780", 40, DuplexMode.FDD, FrequencyRange.FR1),
        70 to BandSpec(70, "AWS-4", "1995-2020", "1695-1710", 25, DuplexMode.FDD, FrequencyRange.FR1),
        71 to BandSpec(71, "600 MHz", "617-652", "663-698", 35, DuplexMode.FDD, FrequencyRange.FR1),
        74 to BandSpec(74, "1500 MHz", "1475-1518", "1427-1470", 20, DuplexMode.FDD, FrequencyRange.FR1),
        77 to BandSpec(77, "3700 MHz", "3300-4200", "3300-4200", 100, DuplexMode.TDD, FrequencyRange.FR1),
        78 to BandSpec(78, "3500 MHz", "3300-3800", "3300-3800", 100, DuplexMode.TDD, FrequencyRange.FR1),
        79 to BandSpec(79, "4700 MHz", "4400-5000", "4400-5000", 100, DuplexMode.TDD, FrequencyRange.FR1),
        257 to BandSpec(257, "28 GHz", "26500-29500", "26500-29500", 400, DuplexMode.TDD, FrequencyRange.FR2),
        258 to BandSpec(258, "26 GHz", "24250-27500", "24250-27500", 400, DuplexMode.TDD, FrequencyRange.FR2),
        260 to BandSpec(260, "39 GHz", "37000-40000", "37000-40000", 400, DuplexMode.TDD, FrequencyRange.FR2),
        261 to BandSpec(261, "28 GHz", "27500-28350", "27500-28350", 400, DuplexMode.TDD, FrequencyRange.FR2),
    )

    fun lte(band: String): BandSpec? = band.toIntOrNull()?.let { lteBands[it] }
    fun nr(band: String): BandSpec? = band.toIntOrNull()?.let { nrBands[it] }
}
