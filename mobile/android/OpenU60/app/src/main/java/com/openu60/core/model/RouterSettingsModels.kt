package com.openu60.core.model

import java.util.UUID

// MARK: - Network Mode

data class NetworkModeConfig(
    val netSelect: String = "WL_AND_5G",
) {
    companion object {
        val empty = NetworkModeConfig()
        val netSelectOptions = listOf(
            "4G/5G" to "WL_AND_5G",
            "LTE + 5G" to "LTE_AND_5G",
            "5G Only" to "Only_5G",
            "4G Only" to "Only_LTE",
            "3G Only" to "Only_WCDMA",
            "2G Only" to "Only_GSM",
        )
    }
}

object NetworkModeParser {
    fun parse(data: Map<String, Any?>): NetworkModeConfig {
        return NetworkModeConfig(netSelect = data["net_select"] as? String ?: "")
    }
}

// MARK: - Cell Lock

data class CellLockStatus(
    val nrPCI: String = "",
    val nrEARFCN: String = "",
    val nrBand: String = "",
    val ltePCI: String = "",
    val lteEARFCN: String = "",
    val locked: Boolean = false,
) {
    companion object {
        val empty = CellLockStatus()
    }
}

data class NeighborCell(
    val id: String = UUID.randomUUID().toString(),
    val pci: String = "",
    val earfcn: String = "",
    val band: String = "",
    val rsrp: String = "",
    val type: String = "",
)

object CellLockParser {
    fun parse(data: Map<String, Any?>): CellLockStatus {
        return CellLockStatus(
            nrPCI = data["nr_pci"] as? String ?: data["nr5g_pci"] as? String ?: "",
            nrEARFCN = data["nr_earfcn"] as? String ?: data["nr5g_earfcn"] as? String ?: "",
            nrBand = data["nr_band"] as? String ?: data["nr5g_band"] as? String ?: "",
            ltePCI = data["lte_pci"] as? String ?: "",
            lteEARFCN = data["lte_earfcn"] as? String ?: "",
            locked = DeviceParser.asBool(data["cell_lock_status"]),
        )
    }

    fun parseNeighbors(data: Map<String, Any?>, type: String): List<NeighborCell> {
        val cells = data["cell_list"] as? List<*> ?: return emptyList()
        return cells.mapNotNull { item ->
            val cell = item as? Map<*, *> ?: return@mapNotNull null
            NeighborCell(
                pci = cell["pci"] as? String ?: "",
                earfcn = cell["earfcn"] as? String ?: "",
                band = cell["band"] as? String ?: "",
                rsrp = cell["rsrp"] as? String ?: "",
                type = type,
            )
        }
    }
}

// MARK: - STC (Smart Tower Connect)

data class STCConfig(
    val lteCollectTimer: String = "",
    val nrsaCollectTimer: String = "",
    val lteWhitelistMax: String = "",
    val nrsaWhitelistMax: String = "",
    val enabled: Boolean = false,
) {
    companion object {
        val empty = STCConfig()
    }
}

object STCParser {
    fun parseParams(data: Map<String, Any?>): STCConfig {
        return STCConfig(
            lteCollectTimer = data["lte_collect_timer"] as? String ?: "",
            nrsaCollectTimer = data["nrsa_collect_timer"] as? String ?: "",
            lteWhitelistMax = data["lte_whitelist_max"] as? String ?: "",
            nrsaWhitelistMax = data["nrsa_whitelist_max"] as? String ?: "",
            enabled = DeviceParser.asBool(data["stc_enable"]),
        )
    }

    fun parseStatus(data: Map<String, Any?>, config: STCConfig): STCConfig {
        return config.copy(enabled = DeviceParser.asBool(data["stc_enable"]) || DeviceParser.asBool(data["status"]))
    }
}

// MARK: - Signal Detect

data class SignalDetectStatus(
    val progress: Int = 0,
    val running: Boolean = false,
    val results: List<SignalQualityResult> = emptyList(),
) {
    companion object {
        val empty = SignalDetectStatus()
    }
}

data class SignalQualityResult(
    val id: String = UUID.randomUUID().toString(),
    val band: String = "",
    val earfcn: String = "",
    val pci: String = "",
    val rsrp: String = "",
    val rsrq: String = "",
    val sinr: String = "",
    val type: String = "",
)

object SignalDetectParser {
    fun parseProgress(data: Map<String, Any?>): SignalDetectStatus {
        return SignalDetectStatus(
            progress = DeviceParser.asInt(data["progress"]) ?: 0,
            running = DeviceParser.asBool(data["running"]),
        )
    }

    fun parseResults(data: Map<String, Any?>): List<SignalQualityResult> {
        val records = data["record_list"] as? List<*> ?: return emptyList()
        return records.mapNotNull { item ->
            val record = item as? Map<*, *> ?: return@mapNotNull null
            SignalQualityResult(
                band = record["band"] as? String ?: "",
                earfcn = record["earfcn"] as? String ?: "",
                pci = record["pci"] as? String ?: "",
                rsrp = record["rsrp"] as? String ?: "",
                rsrq = record["rsrq"] as? String ?: "",
                sinr = record["sinr"] as? String ?: "",
                type = record["type"] as? String ?: "",
            )
        }
    }
}

// MARK: - Mobile Network

data class MobileNetworkConfig(
    val connectMode: Int = 1,
    val roamEnable: Int = 0,
    val dataEnabled: Int = 0,
    val connectStatus: String = "",
    val netSelectMode: String = "auto_select",
    val operators: List<NetworkOperator> = emptyList(),
    val scanStatus: String = "",
) {
    val isAutoConnect: Boolean get() = connectMode == 1
    val isRoamingEnabled: Boolean get() = roamEnable == 1
    val isDataEnabled: Boolean get() = dataEnabled == 1
    val isConnected: Boolean get() = connectStatus.contains("connected")
    val isAutoNetSelect: Boolean get() = netSelectMode == "auto_select"

    companion object {
        val empty = MobileNetworkConfig()
    }
}

data class NetworkOperator(
    val id: String = UUID.randomUUID().toString(),
    val name: String = "",
    val mccMnc: String = "",
    val rat: String = "",
    val status: String = "available",
)

object MobileNetworkParser {
    fun parseWWAN(data: Map<String, Any?>): WWANResult {
        return WWANResult(
            connectMode = DeviceParser.asInt(data["connect_mode"]) ?: 1,
            roamEnable = DeviceParser.asInt(data["roam_enable"]) ?: 0,
            dataEnabled = DeviceParser.asInt(data["enable"]) ?: 1,
            connectStatus = data["connect_status"] as? String ?: "",
        )
    }

    fun parseNetInfo(data: Map<String, Any?>): String {
        return data["net_select_mode"] as? String ?: "auto_select"
    }

    fun parseScanStatus(data: Map<String, Any?>): String {
        return data["m_netselect_status"] as? String ?: ""
    }

    fun parseScanResults(data: Map<String, Any?>): List<NetworkOperator> {
        val list = data["m_netselect_contents"] as? List<*> ?: return emptyList()
        return list.mapNotNull { item ->
            val map = item as? Map<*, *> ?: return@mapNotNull null
            NetworkOperator(
                name = map["name"] as? String ?: map["operator_name"] as? String ?: "",
                mccMnc = map["mcc_mnc"] as? String ?: map["plmn"] as? String ?: "",
                rat = map["rat"] as? String ?: "",
                status = map["status"] as? String ?: "available",
            )
        }
    }

    fun parseRegisterResult(data: Map<String, Any?>): String {
        return data["m_netselect_result"] as? String ?: ""
    }

    data class WWANResult(
        val connectMode: Int,
        val roamEnable: Int,
        val dataEnabled: Int,
        val connectStatus: String,
    )
}

// MARK: - APN

data class APNConfig(
    val mode: String = "",
    val profiles: List<APNProfile> = emptyList(),
    val autoProfiles: List<APNProfile> = emptyList(),
) {
    val isManual: Boolean get() = mode == "1"

    companion object {

        val empty = APNConfig()
    }
}

data class APNProfile(
    val id: String = "",
    val name: String = "",
    val apn: String = "",
    val pdpType: Int = 3,
    val authMode: Int = 0,
    val username: String = "",
    val password: String = "",
    val active: Boolean = false,
) {
    companion object {
        val empty = APNProfile()
        val pdpTypeOptions = listOf("IPv4" to 1, "IPv6" to 2, "IPv4v6" to 3)
        val authModeOptions = listOf("None" to 0, "PAP" to 1, "CHAP" to 2)
    }

    val pdpTypeLabel: String get() = pdpTypeOptions.firstOrNull { it.second == pdpType }?.first ?: "IPv4v6"
    val authModeLabel: String get() = authModeOptions.firstOrNull { it.second == authMode }?.first ?: "None"
}

object APNParser {
    fun parseMode(data: Map<String, Any?>): String {
        val v = data["apn_mode"]
        return when (v) {
            is Int -> v.toString()
            is String -> v
            else -> "0"
        }
    }

    fun parseProfiles(data: Map<String, Any?>): List<APNProfile> {
        val list = data["apnListArray"] as? List<*> ?: return emptyList()
        return list.mapNotNull { item ->
            val map = item as? Map<*, *> ?: return@mapNotNull null
            val id = map["profileId"] as? String ?: ""
            if (id.isEmpty()) return@mapNotNull null
            val name = map["profilename"] as? String ?: ""
            val apn = map["wanapn"] as? String ?: ""
            if (name.isEmpty() && apn.isEmpty()) return@mapNotNull null
            APNProfile(
                id = id,
                name = name,
                apn = apn,
                pdpType = DeviceParser.asInt(map["pdpType"]) ?: 3,
                authMode = DeviceParser.asInt(map["pppAuthMode"]) ?: 0,
                username = map["username"] as? String ?: "",
                password = map["password"] as? String ?: "",
                active = DeviceParser.asBool(map["isEnable"]),
            )
        }
    }
}

// MARK: - WiFi

data class WiFiConfig(
    val ssid2g: String = "",
    val ssid5g: String = "",
    val key2g: String = "",
    val key5g: String = "",
    val channel2g: String = "auto",
    val channel5g: String = "auto",
    val txpower2g: String = "100",
    val txpower5g: String = "100",
    val encryption2g: String = "psk2+ccmp",
    val encryption5g: String = "psk2+ccmp",
    val wifiOnOff: Boolean = true,
    val hidden2g: Boolean = false,
    val hidden5g: Boolean = false,
    val radio2gDisabled: Boolean = false,
    val radio5gDisabled: Boolean = false,
    val wifi7Enabled: Boolean = false,
    val bandwidth2g: String = "auto",
    val bandwidth5g: String = "auto",
    val country: String = "CN",
    val maxAssoc: String = "32",
) {
    companion object {
        val empty = WiFiConfig()
        val channelOptions2g = listOf("auto", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11")
        val channelOptions5g = listOf("auto", "36", "40", "44", "48", "52", "56", "60", "64", "100", "104", "108", "112", "116", "120", "124", "128", "132", "136", "140", "149", "153", "157", "161", "165")
        val txpowerOptions = listOf("10", "20", "30", "40", "50", "60", "70", "80", "90", "100")
        val encryptionOptions = listOf("none", "psk+tkip", "psk+ccmp", "psk2+ccmp", "psk-mixed+ccmp", "sae", "sae-mixed")
        val bandwidthOptions2g = listOf("auto", "EHT20", "EHT40")
        val bandwidthOptions5g = listOf("auto", "EHT20", "EHT40", "EHT80", "EHT160")
        val maxAssocOptions = listOf("8", "16", "32", "64", "128")

        fun channels5g(bandwidth: String): List<String> = when (bandwidth) {
            "EHT160" -> listOf("auto", "36", "40", "44", "48", "52", "56", "60", "64", "100", "104", "108", "112", "116", "120", "124", "128")
            "EHT80" -> listOf("auto", "36", "40", "44", "48", "52", "56", "60", "64", "100", "104", "108", "112", "116", "120", "124", "128", "149", "153", "157", "161")
            "EHT40" -> listOf("auto", "36", "40", "44", "48", "52", "56", "60", "64", "100", "104", "108", "112", "116", "120", "124", "128", "132", "136", "140", "149", "153", "157", "161")
            else -> channelOptions5g
        }

        fun bandwidths5g(channel: String): List<String> {
            if (channel == "auto") return bandwidthOptions5g
            val ch = channel.toIntOrNull() ?: return bandwidthOptions5g
            return when {
                ch == 165 -> listOf("auto", "EHT20")
                ch >= 149 -> listOf("auto", "EHT20", "EHT40", "EHT80")
                ch >= 132 -> listOf("auto", "EHT20", "EHT40")
                else -> bandwidthOptions5g
            }
        }
    }
}

object WiFiParser {
    fun parse(data: Map<String, Any?>): WiFiConfig {
        val isCompanion = data["htmode_2g"] != null
        return WiFiConfig(
            ssid2g = data["ssid_2g"] as? String ?: "",
            ssid5g = data["ssid_5g"] as? String ?: "",
            key2g = data["key_2g"] as? String ?: "",
            key5g = data["key_5g"] as? String ?: "",
            channel2g = normalizeChannel(data["channel_2g"] as? String),
            channel5g = normalizeChannel(data["channel_5g"] as? String),
            txpower2g = data["txpower_2g"] as? String ?: "100",
            txpower5g = data["txpower_5g"] as? String ?: "100",
            encryption2g = data["encryption_2g"] as? String ?: "psk2+ccmp",
            encryption5g = data["encryption_5g"] as? String ?: "psk2+ccmp",
            wifiOnOff = DeviceParser.asBool(data["wifi_onoff"]),
            hidden2g = DeviceParser.asBool(data["hidden_2g"]),
            hidden5g = DeviceParser.asBool(data["hidden_5g"]),
            radio2gDisabled = DeviceParser.asBool(data["radio2_disabled"]),
            radio5gDisabled = DeviceParser.asBool(data["radio5_disabled"]),
            wifi7Enabled = if (isCompanion) DeviceParser.asBool(data["wifi6_switch"]) else false,
            bandwidth2g = if (isCompanion) normalizeBandwidth(data["htmode_2g"] as? String, false) else "auto",
            bandwidth5g = if (isCompanion) normalizeBandwidth(data["htmode_5g"] as? String, true) else "auto",
            country = data["country"] as? String ?: "CN",
            maxAssoc = data["maxassoc"] as? String ?: "32",
        )
    }

    private fun normalizeBandwidth(raw: String?, is5g: Boolean = true): String {
        if (raw.isNullOrEmpty()) return "auto"
        val options = if (is5g) WiFiConfig.bandwidthOptions5g else WiFiConfig.bandwidthOptions2g
        return if (raw in options) raw else "auto"
    }

    private fun normalizeChannel(raw: String?): String {
        if (raw.isNullOrEmpty() || raw == "0") return "auto"
        return raw
    }
}

// MARK: - Guest WiFi

data class GuestWiFiConfig(
    val enabled2g: Boolean = false,
    val enabled5g: Boolean = false,
    val ssid: String = "",
    val key: String = "",
    val encryption: String = "psk2+ccmp",
    val hidden: Boolean = false,
    val isolate: Boolean = true,
    val activeTime: Int = 0,
    val remainingSeconds: Int = -1,
) {
    companion object {
        val empty = GuestWiFiConfig()
        val activeTimeOptions = listOf(
            "No Limit" to 0, "30 min" to 30, "1 hour" to 60, "2 hours" to 120,
            "4 hours" to 240, "8 hours" to 480, "12 hours" to 720, "24 hours" to 1440,
        )
    }
}

object GuestWiFiParser {
    fun parse(data: Map<String, Any?>): GuestWiFiConfig {
        return GuestWiFiConfig(
            enabled2g = !DeviceParser.asBool(data["disabled_2g"]),
            enabled5g = !DeviceParser.asBool(data["disabled_5g"]),
            ssid = data["ssid"] as? String ?: "",
            key = data["key"] as? String ?: "",
            encryption = data["encryption"] as? String ?: "psk2+ccmp",
            hidden = DeviceParser.asBool(data["hidden"]),
            isolate = DeviceParser.asBool(data["isolate"]),
            activeTime = DeviceParser.asInt(data["guest_active_time"]) ?: 0,
            remainingSeconds = DeviceParser.asInt(data["remaining_seconds"]) ?: -1,
        )
    }
}

// MARK: - LAN/DHCP

data class LANConfig(
    val lanIP: String = "",
    val netmask: String = "",
    val dhcpEnabled: Boolean = false,
    val dhcpStart: String = "",
    val dhcpEnd: String = "",
    val dhcpLeaseTime: String = "",
) {
    companion object {
        val empty = LANConfig()
    }
}

object LANParser {
    fun parse(data: Map<String, Any?>): LANConfig {
        return LANConfig(
            lanIP = data["lan_ipaddr"] as? String ?: "",
            netmask = data["lan_netmask"] as? String ?: "",
            dhcpEnabled = DeviceParser.asBool(data["dhcp_enable"]),
            dhcpStart = data["dhcp_start"] as? String ?: "",
            dhcpEnd = data["dhcp_end"] as? String ?: "",
            dhcpLeaseTime = data["dhcp_lease_time"] as? String ?: "",
        )
    }
}

// MARK: - QoS

data class QoSConfig(
    val enabled: Boolean = false,
) {
    companion object {
        val empty = QoSConfig()
    }
}

object QoSParser {
    fun parse(data: Map<String, Any?>): QoSConfig {
        return QoSConfig(enabled = DeviceParser.asBool(data["qos_switch"]))
    }
}

// MARK: - VPN Passthrough

data class VPNPassthroughConfig(
    val l2tp: Boolean = false,
    val pptp: Boolean = false,
    val ipsec: Boolean = false,
) {
    companion object {
        val empty = VPNPassthroughConfig()
    }
}

object VPNPassthroughParser {
    fun parse(data: Map<String, Any?>): VPNPassthroughConfig {
        return VPNPassthroughConfig(
            l2tp = DeviceParser.asBool(data["l2tp_passthrough"]),
            pptp = DeviceParser.asBool(data["pptp_passthrough"]),
            ipsec = DeviceParser.asBool(data["ipsec_passthrough"]),
        )
    }
}

// MARK: - Scheduled Reboot

data class ScheduleRebootConfig(
    val enabled: Boolean = false,
    val time: String = "03:00",
    val days: String = "",
) {
    companion object {
        val empty = ScheduleRebootConfig()
        val dayOptions = listOf(
            "Mon" to "1", "Tue" to "2", "Wed" to "3", "Thu" to "4",
            "Fri" to "5", "Sat" to "6", "Sun" to "0",
        )
    }
}

object ScheduleRebootParser {
    fun parse(data: Map<String, Any?>): ScheduleRebootConfig {
        return ScheduleRebootConfig(
            enabled = DeviceParser.asBool(data["auto_reboot_enable"]),
            time = data["auto_reboot_time"] as? String ?: "03:00",
            days = data["auto_reboot_days"] as? String ?: "",
        )
    }
}
