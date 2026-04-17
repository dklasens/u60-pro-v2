package com.openu60.core.model

import java.util.UUID

// MARK: - DNS

data class DNSConfig(
    val wanDnsMode: String = "",
    val primaryDns: String = "",
    val secondaryDns: String = "",
    val ipv6PrimaryDns: String = "",
    val ipv6SecondaryDns: String = "",
    val ipv6DnsMode: String = "",
) {
    val isManual: Boolean get() = wanDnsMode == "manual"

    companion object {
        val empty = DNSConfig()
    }
}

object DNSParser {
    fun parse(data: Map<String, Any?>): DNSConfig {
        return DNSConfig(
            wanDnsMode = data["dns_mode"] as? String ?: "",
            primaryDns = data["prefer_dns_manual"] as? String ?: "",
            secondaryDns = data["standby_dns_manual"] as? String ?: "",
            ipv6PrimaryDns = data["ipv6_prefer_dns_manual"] as? String ?: "",
            ipv6SecondaryDns = data["ipv6_standby_dns_manual"] as? String ?: "",
            ipv6DnsMode = data["ipv6_dns_mode"] as? String ?: "",
        )
    }
}

// MARK: - Firewall

data class FirewallConfig(
    val enabled: Boolean = false,
    val nat: Boolean = false,
    val dmzEnabled: Boolean = false,
    val dmzHost: String = "",
    val level: String = "medium",
    val wanPingFilter: Boolean = false,
    val portForwardEnabled: Boolean = false,
) {
    companion object {
        val empty = FirewallConfig()
    }
}

data class PortForwardRule(
    val id: String = "",
    val name: String = "",
    val protocol: String = "",
    val wanPort: String = "",
    val lanIP: String = "",
    val lanPort: String = "",
    val enabled: Boolean = false,
)

data class FilterRule(
    val id: String = "",
    val srcMac: String = "",
    val srcIP: String = "",
    val srcPort: String = "",
    val destIP: String = "",
    val destPort: String = "",
    val protocol: String = "",
    val enabled: Boolean = false,
)

object FirewallParser {
    fun parseConfig(data: Map<String, Any?>): FirewallConfig {
        return FirewallConfig(
            enabled = DeviceParser.asBool(data["firewall_switch"]),
            nat = DeviceParser.asBool(data["nat_switch"]),
            dmzEnabled = DeviceParser.asBool(data["dmz_enabled"]),
            dmzHost = data["dmz_ip"] as? String ?: "",
            level = data["firewall_level"] as? String ?: "medium",
            wanPingFilter = DeviceParser.asBool(data["wan_ping_filter"]),
            portForwardEnabled = DeviceParser.asBool(data["port_forward_switch"]),
        )
    }

    fun parsePortForwardRules(data: Map<String, Any?>): List<PortForwardRule> {
        val rules = data["rule_list"] as? List<*> ?: return emptyList()
        return rules.mapIndexed { index, item ->
            val rule = item as? Map<*, *> ?: return@mapIndexed null
            PortForwardRule(
                id = rule["id"] as? String ?: "$index",
                name = rule["name"] as? String ?: "",
                protocol = rule["protocol"] as? String ?: "",
                wanPort = rule["wan_port"] as? String ?: "",
                lanIP = rule["lan_ip"] as? String ?: "",
                lanPort = rule["lan_port"] as? String ?: "",
                enabled = DeviceParser.asBool(rule["enabled"]),
            )
        }.filterNotNull()
    }

    fun parseFilterRules(data: Map<String, Any?>): List<FilterRule> {
        val rules = data["rule_list"] as? List<*> ?: return emptyList()
        return rules.mapIndexed { index, item ->
            val rule = item as? Map<*, *> ?: return@mapIndexed null
            FilterRule(
                id = rule["id"] as? String ?: "$index",
                srcMac = rule["src_mac"] as? String ?: "",
                srcIP = rule["src_ip"] as? String ?: "",
                srcPort = rule["src_port"] as? String ?: "",
                destIP = rule["dest_ip"] as? String ?: "",
                destPort = rule["dest_port"] as? String ?: "",
                protocol = rule["protocol"] as? String ?: "",
                enabled = DeviceParser.asBool(rule["enabled"]),
            )
        }.filterNotNull()
    }
}

// MARK: - Telemetry / Domain Filter

data class DomainFilterConfig(
    val enabled: Boolean = false,
    val rules: List<DomainFilterRule> = emptyList(),
) {
    companion object {
        val empty = DomainFilterConfig()
    }
}

data class DomainFilterRule(
    val id: String = "",
    val domain: String = "",
    val enabled: Boolean = false,
)

object TelemetryParser {
    fun parseDomainFilter(data: Map<String, Any?>): DomainFilterConfig {
        val enabled = DeviceParser.asBool(data["enable"])
        val ruleList = data["rule_list"] as? List<*> ?: emptyList<Any>()
        val rules = ruleList.mapIndexed { index, item ->
            val rule = item as? Map<*, *> ?: return@mapIndexed null
            DomainFilterRule(
                id = rule["id"] as? String ?: "$index",
                domain = rule["domain"] as? String ?: "",
                enabled = DeviceParser.asBool(rule["enabled"]),
            )
        }.filterNotNull()
        return DomainFilterConfig(enabled = enabled, rules = rules)
    }

    val knownTelemetryDomains = listOf(
        "dclient.ztems.com",
        "dconfig.ztems.com",
        "iot.ztems.com",
        "mcs-cloud.ztems.com",
        "update.ztems.com",
    )
}

// MARK: - DoH (DNS-over-HTTPS)

data class DoHStatus(
    val enabled: Boolean = false,
    val upstreamUrl: String = "",
    val cacheEntries: Int = 0,
    val cacheHits: Int = 0,
    val cacheMisses: Int = 0,
    val queriesTotal: Int = 0,
) {
    val hitRatio: Double
        get() {
            val total = cacheHits + cacheMisses
            return if (total > 0) cacheHits.toDouble() / total * 100.0 else 0.0
        }

    companion object {
        val empty = DoHStatus()
    }
}

data class DoHCacheEntry(
    val domain: String = "",
    val type: String = "?",
    val typeId: Int = 0,
    val ttl: Int = 0,
) {
    val id: String get() = "$domain-$typeId"
}

object DoHParser {
    fun parse(data: Map<String, Any?>): DoHStatus {
        val running = data["running"] as? Boolean ?: false
        val config = data["config"] as? Map<*, *> ?: emptyMap<String, Any>()
        val stats = data["stats"] as? Map<*, *> ?: emptyMap<String, Any>()
        return DoHStatus(
            enabled = running,
            upstreamUrl = config["upstream_url"] as? String ?: "",
            cacheEntries = DeviceParser.asInt(stats["cache_entries"]) ?: 0,
            cacheHits = DeviceParser.asInt(stats["cache_hits"]) ?: 0,
            cacheMisses = DeviceParser.asInt(stats["cache_misses"]) ?: 0,
            queriesTotal = DeviceParser.asInt(stats["queries_total"]) ?: 0,
        )
    }

    fun parseCacheEntries(list: List<Map<String, Any?>>): List<DoHCacheEntry> {
        return list.map { entry ->
            DoHCacheEntry(
                domain = entry["domain"] as? String ?: "",
                type = entry["type"] as? String ?: "?",
                typeId = DeviceParser.asInt(entry["type_id"]) ?: 0,
                ttl = DeviceParser.asInt(entry["ttl"]) ?: 0,
            )
        }
    }
}
