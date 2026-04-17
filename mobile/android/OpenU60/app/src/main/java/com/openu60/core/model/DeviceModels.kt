package com.openu60.core.model

import kotlin.math.abs
import kotlin.math.pow
import kotlin.math.roundToLong

data class BatteryStatus(
    val capacity: Int = 0,
    val temperature: Double = 0.0,
    val charging: String = "",
    val chargeStatus: Int = 0,
    val timeToFull: Int = -1,
    val timeToEmpty: Int = -1,
    val currentMA: Int? = null,
    val voltageMV: Int? = null,
) {
    companion object {
        val empty = BatteryStatus()
    }
}

data class ThermalStatus(
    val cpuTemp: Double = 0.0,
) {
    companion object {
        val empty = ThermalStatus()
    }
}

data class TrafficStats(
    val rxBytes: Long = 0,
    val txBytes: Long = 0,
    val rxBps: Double = 0.0,
    val txBps: Double = 0.0,
    val timestamp: Long = System.currentTimeMillis(),
    val source: String = "",
) {
    companion object {
        val empty = TrafficStats()
    }
}

data class TrafficSpeed(
    val downloadBytesPerSec: Double = 0.0,
    val uploadBytesPerSec: Double = 0.0,
) {
    companion object {
        val zero = TrafficSpeed()
    }
}

data class ConnectedDevice(
    val id: String,
    val name: String,
    val ipAddress: String,
    val ip6Addresses: List<String>,
    val macAddress: String,
    val dhcpHostname: String,
) {
    val displayName: String
        get() = when {
            dhcpHostname.isNotEmpty() -> dhcpHostname
            name.isNotEmpty() -> name
            else -> macAddress
        }
}

data class DeviceIdentity(
    val imei: String = "",
    val simICCID: String = "",
    val simIMSI: String = "",
    val msisdn: String = "",
    val wanIPv4: String = "",
    val wanIPv6: List<String> = emptyList(),
    val lanIP: String = "",
    val spn: String = "",
    val mcc: String = "",
    val mnc: String = "",
    val simStatus: String = "",
) {
    companion object {
        val empty = DeviceIdentity()
    }
}

data class WifiStatus(
    val wifiOn: Boolean = false,
    val ssid2g: String = "",
    val ssid5g: String = "",
    val channel2g: String = "",
    val channel5g: String = "",
    val radio2gDisabled: Boolean = false,
    val radio5gDisabled: Boolean = false,
    val encryption2g: String = "",
    val encryption5g: String = "",
    val hidden2g: Boolean = false,
    val hidden5g: Boolean = false,
    val txPower2g: String = "",
    val txPower5g: String = "",
    val bandwidth2g: String = "",
    val bandwidth5g: String = "",
    val clientsTotal: Int = 0,
    val wifi6: Boolean = false,
    val guestEnabled: Boolean = false,
    val guestSsid: String = "",
) {
    companion object {
        val empty = WifiStatus()
    }
}

data class CpuStatSample(
    val idle: Long,
    val total: Long,
)

data class SystemInfo(
    val model: String = "ZTE U60 Pro",
    val firmware: String = "",
    val cpuUsagePercent: Double = 0.0,
    val cpuUsageIsEstimate: Boolean = false,
    val cpuCores: Int = 1,
    val uptime: Int = 0,
    val memTotal: Long = 0,
    val memUsed: Long = 0,
    val memFree: Long = 0,
    val memUsagePct: Double = 0.0,
) {
    companion object {
        val empty = SystemInfo()
    }
}

data class UsagePeriod(
    val rxBytes: Long = 0,
    val txBytes: Long = 0,
    val timeSecs: Long = 0,
)

data class DataUsage(
    val day: UsagePeriod = UsagePeriod(),
    val month: UsagePeriod = UsagePeriod(),
    val total: UsagePeriod = UsagePeriod(),
) {
    companion object {
        val empty = DataUsage()
    }
}

data class USBStatus(
    val mode: String = "",
    val typecCC: String = "no_cc",
    val dataConnected: Boolean = false,
    val powerbankActive: Boolean = false,
) {
    val cableAttached: Boolean get() = typecCC != "no_cc"

    companion object {
        val empty = USBStatus()
    }
}

// MARK: - Parsers

object DeviceParser {

    fun parseDataUsage(data: Map<String, Any?>): DataUsage {
        fun parsePeriod(p: Any?): UsagePeriod {
            val m = p as? Map<*, *> ?: return UsagePeriod()
            return UsagePeriod(
                rxBytes = asLong(m["rx_bytes"]) ?: 0,
                txBytes = asLong(m["tx_bytes"]) ?: 0,
                timeSecs = asLong(m["time_secs"]) ?: 0,
            )
        }
        return DataUsage(
            day = parsePeriod(data["day"]),
            month = parsePeriod(data["month"]),
            total = parsePeriod(data["total"]),
        )
    }

    fun parseBattery(data: Map<String, Any?>): BatteryStatus {
        return BatteryStatus(
            capacity = asInt(data["percent"]) ?: asInt(data["capacity"]) ?: 0,
            temperature = asDouble(data["temperature_c"]) ?: (asDouble(data["temperature"])?.let { it / 10.0 }) ?: 0.0,
            charging = if (asBool(data["charging"]) || data["status"] == "Charging") "charging" else "discharging",
            voltageMV = asInt(data["voltage_mv"]) ?: (asInt(data["voltage_uv"])?.let { it / 1000 }),
            currentMA = asInt(data["current_ma"]) ?: (asInt(data["current_ua"])?.let { it / 1000 }),
        )
    }

    fun parseSpeed(data: Map<String, Any?>): TrafficStats {
        return TrafficStats(
            rxBytes = asLong(data["rx_bytes"]) ?: 0,
            txBytes = asLong(data["tx_bytes"]) ?: 0,
            rxBps = (asDouble(data["rx_bps"]) ?: 0.0) / 8.0, // bps to Bps
            txBps = (asDouble(data["tx_bps"]) ?: 0.0) / 8.0, // bps to Bps
            timestamp = System.currentTimeMillis(),
            source = "unified_speed"
        )
    }

    fun parseSystem(
        deviceData: Map<String, Any?>,
        cpuData: Map<String, Any?>,
        memData: Map<String, Any?>
    ): SystemInfo {
        return SystemInfo(
            model = stringVal(deviceData["model"]),
            firmware = stringVal(deviceData["firmware"]),
            uptime = asInt(deviceData["uptime_secs"]) ?: 0,
            cpuUsagePercent = asDouble(cpuData["overall"]) ?: 0.0,
            cpuCores = asInt(cpuData["cores"]) ?: 1,
            memTotal = asLong(memData["total_kb"]) ?: 0,
            memUsed = asLong(memData["used_kb"]) ?: 0,
            memFree = asLong(memData["free_kb"]) ?: 0,
            memUsagePct = asDouble(memData["usage_pct"]) ?: 0.0,
        )
    }

    fun parseHostHints(data: Map<String, Any?>): List<ConnectedDevice> {
        // Handle new format: { clients: [{ mac, ip, hostname }] }
        val clients = data["clients"] as? List<*>
        if (clients != null) {
            return clients.mapNotNull { item ->
                val info = item as? Map<*, *> ?: return@mapNotNull null
                val mac = info["mac"] as? String ?: ""
                val ip = info["ip"] as? String ?: ""
                val hostname = info["hostname"] as? String ?: ""
                ConnectedDevice(
                    id = mac,
                    name = hostname,
                    ipAddress = ip,
                    ip6Addresses = emptyList(),
                    macAddress = mac,
                    dhcpHostname = hostname
                )
            }.sortedWith(compareBy { it.ipAddress })
        }

        // Fallback to legacy format
        val devices = mutableListOf<ConnectedDevice>()
        for ((mac, value) in data) {
            val info = value as? Map<*, *> ?: continue
            val name = info["name"] as? String ?: ""
            val ipAddrs = info["ipaddrs"] as? List<*> ?: emptyList<String>()
            val ip6Addrs = info["ip6addrs"] as? List<*> ?: emptyList<String>()
            val ip = ipAddrs.firstOrNull()?.toString() ?: ""
            devices.add(ConnectedDevice(
                id = mac,
                name = name,
                ipAddress = ip,
                ip6Addresses = ip6Addrs.mapNotNull { it?.toString() },
                macAddress = mac,
                dhcpHostname = "",
            ))
        }
        return devices.sortedWith(compareBy { it.ipAddress })
    }

    fun enrichWithDHCP(devices: List<ConnectedDevice>, leases: Any?): List<ConnectedDevice> {
        val leaseMap = mutableMapOf<String, String>()
        val leaseList = when (leases) {
            is List<*> -> leases
            is Map<*, *> -> leases["dhcp_leases"] as? List<*>
            else -> null
        }
        if (leaseList != null) {
            for (item in leaseList) {
                val lease = item as? Map<*, *> ?: continue
                val mac = (lease["macaddr"] as? String)?.uppercase() ?: continue
                val hostname = lease["hostname"] as? String ?: continue
                leaseMap[mac] = hostname
            }
        }
        return devices.map { device ->
            val hostname = leaseMap[device.macAddress.uppercase()]
            if (hostname != null && device.dhcpHostname.isEmpty()) {
                device.copy(dhcpHostname = hostname)
            } else device
        }
    }

    fun parseIdentity(
        simInfo: Map<String, Any?>,
        imeiData: Map<String, Any?>,
        wanStatus: Map<String, Any?>,
        wan6Status: Map<String, Any?>,
        lanStatus: Map<String, Any?>,
    ): DeviceIdentity {
        val wanIPv4 = (wanStatus["ipv4-address"] as? List<*>)
            ?.firstOrNull()?.let { (it as? Map<*, *>)?.get("address") as? String } ?: ""

        val wanIPv6 = (wan6Status["ipv6-address"] as? List<*>)
            ?.mapNotNull { entry ->
                val addr = (entry as? Map<*, *>)?.get("address") as? String
                addr?.takeIf { !it.startsWith("fe80") }
            } ?: emptyList()

        val lanIP = (lanStatus["ipv4-address"] as? List<*>)
            ?.firstOrNull()?.let { (it as? Map<*, *>)?.get("address") as? String } ?: ""

        val spnHex = simInfo["spn_name_data"] as? String
        val spn = if (spnHex != null) decodeSpn(spnHex) else ""

        return DeviceIdentity(
            imei = imeiData["imei"] as? String ?: "",
            simICCID = simInfo["sim_iccid"] as? String ?: "",
            simIMSI = simInfo["sim_imsi"] as? String ?: "",
            msisdn = simInfo["msisdn"] as? String ?: "",
            wanIPv4 = wanIPv4,
            wanIPv6 = wanIPv6,
            lanIP = lanIP,
            spn = spn,
            mcc = simInfo["mdm_mcc"] as? String ?: "",
            mnc = simInfo["mdm_mnc"] as? String ?: "",
            simStatus = simInfo["sim_states"] as? String ?: "",
        )
    }

    // MARK: - SPN Decoder

    fun decodeSpn(hex: String): String {
        val trimmed = hex.trim()
        if (trimmed.isEmpty() || trimmed.length % 4 != 0) return ""
        val sb = StringBuilder()
        var i = 0
        while (i + 3 < trimmed.length) {
            val code = trimmed.substring(i, i + 4).toIntOrNull(16)
            if (code != null && code != 0) {
                sb.append(code.toChar())
            }
            i += 4
        }
        return sb.toString()
    }

    // MARK: - USB Parser

    fun parseUSBStatus(usbData: Map<String, Any?>, chargerData: Map<String, Any?>?): USBStatus {
        return USBStatus(
            mode = usbData["mode"] as? String ?: "",
            typecCC = usbData["typec_cc"] as? String ?: "no_cc",
            dataConnected = asInt(usbData["connect"]) == 1,
            powerbankActive = asInt(chargerData?.get("otg_powerbank_state")) == 1,
        )
    }

    // MARK: - WiFi Parser

    fun parseWifiStatus(data: Map<String, Any?>): WifiStatus {
        return WifiStatus(
            wifiOn = (data["wifi_onoff"] as? String) == "1" || asBool(data["enabled"]),
            ssid2g = data["main2g_ssid"] as? String ?: data["ssid_2g"] as? String ?: "",
            ssid5g = data["main5g_ssid"] as? String ?: data["ssid_5g"] as? String ?: "",
            radio2gDisabled = (data["radio2_disabled"] as? String) == "1" || (data["radio2_disabled"] as? Boolean) == true,
            radio5gDisabled = (data["radio5_disabled"] as? String) == "1" || (data["radio5_disabled"] as? Boolean) == true,
        )
    }

    fun formatEncryption(raw: String): String = when (raw.lowercase()) {
        "psk2", "psk2+ccmp" -> "WPA2"
        "sae" -> "WPA3"
        "sae-mixed", "sae+psk2" -> "WPA2/3"
        "psk-mixed", "psk+psk2" -> "WPA/2"
        "psk" -> "WPA"
        "none", "" -> "Open"
        else -> raw.uppercase()
    }

    // MARK: - WAN Parser

    fun parseWanIPv4(data: Map<String, Any?>): String {
        val ipv4Arr = data["ipv4-address"] as? List<*> ?: return ""
        val first = ipv4Arr.firstOrNull() as? Map<*, *> ?: return ""
        return first["address"] as? String ?: ""
    }

    fun parseWanIPv6(data: Map<String, Any?>): String {
        val ipv6Arr = data["ipv6-address"] as? List<*>
        if (ipv6Arr != null) {
            for (entry in ipv6Arr) {
                val addr = (entry as? Map<*, *>)?.get("address") as? String
                if (addr != null && !addr.startsWith("fe80")) return addr
            }
        }
        val ipv6Prefix = data["ipv6-prefix-assignment"] as? List<*>
        if (ipv6Prefix != null) {
            for (entry in ipv6Prefix) {
                val addr = (entry as? Map<*, *>)?.get("address") as? String
                if (addr != null && !addr.startsWith("fe80")) return addr
            }
        }
        return ""
    }

    // MARK: - Formatting

    data class FormattedValue(val number: Double, val unit: String, val decimalPlaces: Int)

    private fun adaptiveDecimals(value: Double): Int {
        val a = abs(value)
        return when {
            a < 10 -> 2
            a < 100 -> 1
            else -> 0
        }
    }

    private fun roundTo(v: Double, decimals: Int): Double {
        val factor = 10.0.pow(decimals)
        return (v * factor).roundToLong() / factor
    }

    fun speedComponents(bytesPerSec: Double): FormattedValue {
        val bits = bytesPerSec * 8.0
        val gb = 1_000_000_000.0
        val mb = 1_000_000.0
        val kb = 1_000.0
        val (raw, unit) = when {
            bits >= gb -> bits / gb to " Gb/s"
            bits >= mb -> bits / mb to " Mb/s"
            bits >= kb -> bits / kb to " Kb/s"
            else -> bits to " b/s"
        }
        return FormattedValue(number = roundTo(raw, 1), unit = unit, decimalPlaces = 1)
    }

    fun bytesComponents(bytes: Long): FormattedValue {
        val b = bytes.toDouble()
        val tb = 1024.0 * 1024.0 * 1024.0 * 1024.0
        val gb = 1024.0 * 1024.0 * 1024.0
        val mb = 1024.0 * 1024.0
        val kb = 1024.0
        val (raw, unit) = when {
            b >= tb -> b / tb to " TB"
            b >= gb -> b / gb to " GB"
            b >= mb -> b / mb to " MB"
            b >= kb -> b / kb to " KB"
            else -> b to " B"
        }
        val dp = adaptiveDecimals(raw)
        return FormattedValue(number = roundTo(raw, dp), unit = unit, decimalPlaces = dp)
    }

    fun formatSpeed(bytesPerSec: Double): String {
        val c = speedComponents(bytesPerSec)
        return "%.${c.decimalPlaces}f${c.unit.trim()}".format(c.number)
    }

    fun formatBytes(bytes: Long): String {
        val c = bytesComponents(bytes)
        return "%.${c.decimalPlaces}f${c.unit.trim()}".format(c.number)
    }

    // MARK: - Helpers

    fun asInt(value: Any?): Int? = when (value) {
        is Int -> value
        is Long -> value.toInt()
        is Double -> value.toInt()
        is String -> value.toIntOrNull()
        else -> null
    }

    fun asDouble(value: Any?): Double? = when (value) {
        is Double -> value
        is Int -> value.toDouble()
        is Long -> value.toDouble()
        is String -> value.toDoubleOrNull()
        else -> null
    }

    fun asLong(value: Any?): Long? = when (value) {
        is Long -> value
        is Int -> value.toLong()
        is Double -> value.toLong()
        is String -> value.toLongOrNull()
        else -> null
    }

    fun asBool(value: Any?): Boolean = when (value) {
        is Boolean -> value
        is String -> value == "1" || value.lowercase() == "true" || value.lowercase() == "on"
        is Int -> value != 0
        else -> false
    }

    fun stringVal(value: Any?): String = when (value) {
        is String -> value
        is Int -> value.toString()
        is Double -> value.toString()
        else -> ""
    }
}

// MARK: - Process Monitor

data class ProcessInfo(
    val pid: Int,
    val name: String,
    val cpuPct: Double,
    val rssKb: Long,
    val state: String,
    val isBloat: Boolean,
)

data class ProcessListResponse(
    val processes: List<ProcessInfo>,
    val totalCount: Int,
    val bloatCount: Int,
    val bloatCpuPct: Double,
    val bloatRssKb: Long,
)

data class KilledProcess(
    val pid: Int,
    val name: String,
)

data class KillBloatResponse(
    val killed: List<KilledProcess>,
    val skipped: List<KilledProcess>,
    val freedRssKb: Long,
)
