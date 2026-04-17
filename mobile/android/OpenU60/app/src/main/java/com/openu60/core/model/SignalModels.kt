package com.openu60.core.model

data class LTECarrier(
    val label: String = "",
    val pci: String = "",
    val band: String = "",
    val earfcn: String = "",
    val bandwidth: String = "",
    val freq: Double? = null,
    val rsrp: Double? = null,
    val rsrq: Double? = null,
    val sinr: Double? = null,
    val rssi: Double? = null,
    val active: Boolean = true,
    val ulConfigured: Boolean = false,
) {
    val id: String get() = "$label-$band-$pci-$earfcn"
}

data class NRSignal(
    val rsrp: Double? = null,
    val rsrq: Double? = null,
    val sinr: Double? = null,
    val rssi: Double? = null,
    val band: String = "",
    val pci: String = "",
    val cellID: String = "",
    val channel: String = "",
    val bandwidth: String = "",
    val freq: Double? = null,
    val active: Boolean = false,
    val ulConfigured: Boolean = false,
    val carrierAggregation: String = "",
    val sccCarriers: List<LTECarrier> = emptyList(),
) {
    val isConnected: Boolean get() = rsrp != null
    val hasSignal: Boolean get() = isConnected || sccCarriers.any { it.rsrp != null }

    companion object {
        val empty = NRSignal()
    }
}

data class LTESignal(
    val rsrp: Double? = null,
    val rsrq: Double? = null,
    val sinr: Double? = null,
    val rssi: Double? = null,
    val pci: String = "",
    val band: String = "",
    val earfcn: String = "",
    val bandwidth: String = "",
    val freq: Double? = null,
    val active: Boolean = false,
    val ulConfigured: Boolean = false,
    val cellID: String = "",
    val carrierAggregation: String = "",
    val caState: String = "",
    val sccCarriers: List<LTECarrier> = emptyList(),
) {
    val isConnected: Boolean get() = rsrp != null
    val hasSignal: Boolean get() = isConnected || sccCarriers.any { it.rsrp != null }

    companion object {
        val empty = LTESignal()
    }
}

data class WCDMASignal(
    val rscp: Double? = null,
    val ecio: Double? = null,
) {
    val isConnected: Boolean get() = rscp != null

    companion object {
        val empty = WCDMASignal()
    }
}

data class OperatorInfo(
    val provider: String = "",
    val networkType: String = "",
    val signalBar: Int = 0,
    val roaming: Boolean = false,
) {
    enum class NetworkMode { SA, NSA, LTE, LEGACY, UNKNOWN }

    val networkMode: NetworkMode
        get() {
            val raw = networkType.uppercase()
            return when {
                raw == "SA" || raw == "5G SA" || raw.contains("NR SA") -> NetworkMode.SA
                raw == "NSA" || raw == "ENDC" || raw == "EN-DC" || raw.contains("NR NSA") || raw == "LTE-NSA" -> NetworkMode.NSA
                raw.contains("LTE") || raw == "4G" || raw == "4G+" -> NetworkMode.LTE
                raw.contains("WCDMA") || raw.contains("UMTS") || raw.contains("GSM")
                    || raw.contains("2G") || raw.contains("3G") -> NetworkMode.LEGACY
                else -> NetworkMode.UNKNOWN
            }
        }

    fun displayNetworkType(nrConnected: Boolean, lteSignal: LTESignal = LTESignal.empty): String {
        if (nrConnected && (networkMode == NetworkMode.LTE || networkMode == NetworkMode.UNKNOWN)) {
            return "5G NSA"
        }
        if (!nrConnected && (networkMode == NetworkMode.SA || networkMode == NetworkMode.NSA)) {
            return if (lteSignal.isConnected) {
                if (lteSignal.sccCarriers.isEmpty()) "4G" else "4G+"
            } else "4G"
        }
        return when (networkMode) {
            NetworkMode.SA -> "5G SA"
            NetworkMode.NSA -> "5G NSA"
            NetworkMode.LTE -> {
                val raw = networkType.uppercase()
                if (raw.contains("CA") || raw == "4G+" || raw.contains("LTE-A") || raw.contains("LTE+")) "4G+" else "4G"
            }
            NetworkMode.LEGACY -> networkType
            NetworkMode.UNKNOWN -> networkType
        }
    }

    fun showNR(nr: NRSignal): Boolean = nr.hasSignal

    fun showLTE(lte: LTESignal): Boolean {
        if (networkMode == NetworkMode.SA) return false
        val raw = networkType.uppercase()
        val hasData = lte.hasSignal
        val actHintsLTE = raw.contains("NSA") || raw.contains("LTE") || raw.contains("E-UTRAN")
            || raw.contains("ENDC") || raw.contains("EN-DC") || raw == "4G" || raw == "4G+"
        val actHintsNR = raw.contains("SA") || raw.contains("NR") || raw.contains("5G")
            || raw.contains("ENDC") || raw.contains("EN-DC") || raw == "LTE-NSA"
        return hasData && (actHintsLTE || raw.isEmpty() || actHintsNR)
    }

    fun show3G(nr: NRSignal, lte: LTESignal, wcdma: WCDMASignal): Boolean {
        return !showNR(nr) && !showLTE(lte) && (wcdma.rscp != null || wcdma.ecio != null)
    }

    companion object {
        val empty = OperatorInfo()
    }
}

data class SignalSnapshot(
    val timestamp: Long = System.currentTimeMillis(),
    val nrRSRP: Double? = null,
    val lteRSRP: Double? = null,
) {
    companion object {
        fun create(nrRSRP: Double?, lteRSRP: Double?): SignalSnapshot {
            return SignalSnapshot(nrRSRP = nrRSRP, lteRSRP = lteRSRP)
        }
    }
}

data class SignalResult(
    val nr: NRSignal,
    val lte: LTESignal,
    val wcdma: WCDMASignal,
    val operatorInfo: OperatorInfo,
)

// MARK: - Parser

object SignalParser {
    private data class BandInfo(val band: Int, val fdlLow: Double, val noffsDl: Int, val nMin: Int, val nMax: Int)

    // Sync with zte-script-ng.js convert4gEarfcnToMhz
    private val LTE_BANDS_LIST = listOf(
        BandInfo(1, 2110.0, 0, 0, 599),
        BandInfo(2, 1930.0, 600, 600, 1199), // Added B2 from generic logic
        BandInfo(3, 1805.0, 1200, 1200, 1949),
        BandInfo(4, 2110.0, 1950, 1950, 2399),
        BandInfo(5, 869.0, 2400, 2400, 2649),
        BandInfo(7, 2620.0, 2750, 2750, 3449),
        BandInfo(8, 925.0, 3450, 3450, 3799),
        BandInfo(12, 729.0, 5010, 5010, 5179),
        BandInfo(13, 746.0, 5180, 5180, 5279),
        BandInfo(14, 758.0, 5280, 5280, 5379),
        BandInfo(17, 734.0, 5730, 5730, 5849),
        BandInfo(18, 860.0, 5850, 5850, 5999),
        BandInfo(19, 875.0, 6000, 6000, 6149),
        BandInfo(20, 791.0, 6150, 6150, 6449),
        BandInfo(25, 1930.0, 8040, 8040, 8689),
        BandInfo(26, 859.0, 8690, 8690, 9209),
        BandInfo(28, 758.0, 9210, 9210, 9659),
        BandInfo(29, 717.0, 9660, 9660, 9769),
        BandInfo(30, 2350.0, 9770, 9770, 9919),
        BandInfo(32, 1452.0, 9920, 9920, 10359),
        BandInfo(34, 2010.0, 36200, 36200, 36349),
        BandInfo(38, 2570.0, 37750, 37750, 38249),
        BandInfo(39, 1880.0, 38250, 38250, 38649),
        BandInfo(40, 2300.0, 38650, 38650, 39649),
        BandInfo(41, 2496.0, 39650, 39650, 41589),
        BandInfo(42, 3400.0, 41590, 41590, 43589),
        BandInfo(43, 3600.0, 43590, 43590, 45589),
        BandInfo(48, 3550.0, 55240, 55240, 56739),
        BandInfo(66, 2110.0, 66436, 66436, 67335),
        BandInfo(71, 617.0, 68586, 68586, 69035)
    )

    private fun earfcnToFreq(earfcn: Int): Double? {
        val info = LTE_BANDS_LIST.find { earfcn >= it.nMin && earfcn <= it.nMax } ?: return null
        return info.fdlLow + 0.1 * (earfcn - info.noffsDl)
    }

    private fun nrarfcnToFreq(arfcn: Int): Double? {
        // Sync with zte-script-ng.js convert5gArfcnToMhz / 3GPP TS 38.104
        return when {
            arfcn >= 0 && arfcn <= 599999 -> 0.005 * arfcn
            arfcn >= 600000 && arfcn <= 2016666 -> 3000.0 + 0.015 * (arfcn - 600000)
            arfcn >= 2016667 && arfcn <= 3279165 -> 24250.0 + 0.06 * (arfcn - 2016667)
            else -> null
        }
    }

    fun parseNetInfo(data: Map<String, Any?>): SignalResult {
        var nr = NRSignal.empty
        var lte = LTESignal.empty
        var wcdma = WCDMASignal.empty
        var op = OperatorInfo.empty

        val nrBand = stringVal(data["nr5g_action_band"]).replace("n", "", ignoreCase = true)
        val nrArfcn = stringVal(data["nr5g_action_channel"])
        val nrArfcnInt = nrArfcn.toIntOrNull()
        nr = nr.copy(
            rsrp = parseSignalDouble(data["nr5g_rsrp"]),
            rsrq = parseSignalDouble(data["nr5g_rsrq"]),
            sinr = parseSignalDouble(data["nr5g_snr"]),
            rssi = parseSignalDouble(data["nr5g_rssi"]),
            band = nrBand,
            pci = stringVal(data["nr5g_pci"]),
            cellID = stringVal(data["nr5g_cell_id"]),
            channel = nrArfcn,
            bandwidth = stringVal(data["nr5g_bandwidth"]),
            carrierAggregation = stringVal(data["nrca"]),
            freq = if (nrArfcnInt != null) nrarfcnToFreq(nrArfcnInt) else null,
            active = parseSignalDouble(data["nr5g_rsrp"]) != null,
            ulConfigured = true
        )

        val nrcaStr = stringVal(data["nrca"])
        val nrCarriers = parseCAString(nrcaStr)
        // NR CA in script-ng is parsed from the nrca string directly which contains RSRP etc.
        // nrca string format: "ul_conf,pci,active,band,arfcn,bw,?,rsrp,rsrq,sinr,rssi;..."
        val nrSccCarriers = nrCarriers.mapIndexed { i, sc ->
            val scArfcn = sc.earfcn.toIntOrNull() ?: 0
            LTECarrier(
                label = "5G SCC$i", pci = sc.pci, band = sc.band,
                earfcn = sc.earfcn, bandwidth = sc.bandwidth,
                freq = nrarfcnToFreq(scArfcn),
                rsrp = sc.rsrp, rsrq = sc.rsrq, sinr = sc.sinr, rssi = sc.rssi,
                active = sc.active,
                ulConfigured = sc.ulConfigured
            )
        }
        nr = nr.copy(sccCarriers = nrSccCarriers)

        // LTE
        val pccPci = stringVal(data["lte_pci"])
        val pccEarfcn = stringVal(data["wan_active_channel"])
        val pccBand = stringVal(data["wan_active_band"])
        val pccEarfcnInt = pccEarfcn.toIntOrNull() ?: 0
        lte = lte.copy(
            rsrp = parseSignalDouble(data["lte_rsrp"]),
            rsrq = parseSignalDouble(data["lte_rsrq"]),
            sinr = parseSignalDouble(data["lte_snr"]),
            rssi = parseSignalDouble(data["lte_rssi"]),
            pci = pccPci,
            earfcn = pccEarfcn,
            band = pccBand,
            cellID = stringVal(data["cell_id"]),
            caState = stringVal(data["lteca_state"]),
            freq = earfcnToFreq(pccEarfcnInt),
            active = parseSignalDouble(data["lte_rsrp"]) != null,
            ulConfigured = true
        )

        val ltecaStr = stringVal(data["lteca"])
        lte = lte.copy(carrierAggregation = ltecaStr)
        val lteCarriers = parseCAString(ltecaStr)
        val ltecasigStr = stringVal(data["ltecasig"])
        val lteSccSigs = parseCASigString(ltecasigStr)

        val sccCarriers = lteCarriers.drop(1).mapIndexed { i, sc ->
            val sig = lteSccSigs.getOrNull(i)
            val scEarfcn = sc.earfcn.toIntOrNull() ?: 0
            LTECarrier(
                label = "SCC${i+1}", pci = sc.pci, band = sc.band,
                earfcn = sc.earfcn, bandwidth = sc.bandwidth,
                freq = earfcnToFreq(scEarfcn),
                rsrp = sig?.rsrp, rsrq = sig?.rsrq, sinr = sig?.sinr, rssi = sig?.rssi,
                active = sig?.active ?: (sig?.rsrp != null),
                ulConfigured = sig?.ulConfigured ?: false
            )
        }
        lte = lte.copy(sccCarriers = sccCarriers)

        wcdma = wcdma.copy(
            rscp = parseSignalDouble(data["rscp"]),
            ecio = parseSignalDouble(data["ecio"]),
        )

        op = op.copy(
            provider = stringVal(data["network_provider_fullname"]).ifEmpty { stringVal(data["network_provider"]) },
            networkType = stringVal(data["network_type"]),
            signalBar = stringVal(data["signalbar"]).toIntOrNull() ?: 0,
            roaming = stringVal(data["simcard_roam"]) == "1",
        )

        return SignalResult(nr, lte, wcdma, op)
    }

    private data class CarrierEntry(
        val pci: String, val band: String, val earfcn: String, val bandwidth: String,
        val rsrp: Double? = null, val rsrq: Double? = null, val sinr: Double? = null, val rssi: Double? = null,
        val ulConfigured: Boolean = false, val active: Boolean = true
    )
    private data class SigEntry(val rsrp: Double?, val rsrq: Double?, val sinr: Double?, val rssi: Double?, val ulConfigured: Boolean, val active: Boolean)

    private fun parseCAString(str: String): List<CarrierEntry> {
        if (str.isBlank()) return emptyList()
        return str.trimEnd(';').split(";").mapNotNull { entry ->
            val parts = entry.split(",").map { it.trim() }
            if (parts.size >= 11) {
                // NR CA format: ul_conf,pci,active,band,arfcn,bw,?,rsrp,rsrq,sinr,rssi
                CarrierEntry(
                    pci = parts[1], band = parts[3], earfcn = parts[4], bandwidth = parts[5],
                    ulConfigured = parts[0] == "1", active = parts[2] == "2",
                    rsrp = parts[7].toDoubleOrNull(), rsrq = parts[8].toDoubleOrNull(),
                    sinr = parts[9].toDoubleOrNull(), rssi = parts[10].toDoubleOrNull()
                )
            } else if (parts.size >= 5) {
                // LTE CA format: pci,band,?,earfcn,bw
                CarrierEntry(pci = parts[0], band = parts[1], earfcn = parts[3], bandwidth = parts[4])
            } else null
        }
    }

    private fun parseCASigString(str: String): List<SigEntry> {
        if (str.isBlank()) return emptyList()
        return str.trimEnd(';').split(";").mapNotNull { entry ->
            val parts = entry.split(",").map { it.trim() }
            if (parts.size >= 6) {
                SigEntry(
                    parts[0].toDoubleOrNull(),
                    parts[1].toDoubleOrNull(),
                    parts[2].toDoubleOrNull(),
                    parts[3].toDoubleOrNull(),
                    ulConfigured = parts[4] == "1",
                    active = parts[5] == "2"
                )
            } else null
        }
    }

    private fun parseSignalDouble(value: Any?): Double? {
        val result = when (value) {
            is Double -> value
            is Int -> value.toDouble()
            is String -> {
                val trimmed = value.trim()
                if (trimmed.isEmpty() || trimmed == "--" || trimmed == "N/A") null
                else trimmed.toDoubleOrNull()
            }
            else -> null
        }
        return result?.takeIf { it in -9000.0..9000.0 }?.takeIf { it != 0.0 }
    }

    private fun stringVal(value: Any?): String = when (value) {
        is String -> value
        is Int -> value.toString()
        is Double -> value.toString()
        else -> ""
    }
}
