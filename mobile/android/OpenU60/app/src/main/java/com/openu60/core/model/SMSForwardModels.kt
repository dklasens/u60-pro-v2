package com.openu60.core.model

data class SmsForwardConfig(
    val enabled: Boolean = false,
    val pollIntervalSecs: Long = 30,
    val markReadAfterForward: Boolean = false,
    val deleteAfterForward: Boolean = false,
    val rules: List<ForwardRule> = emptyList(),
)

data class ForwardRule(
    val id: Int,
    val name: String,
    val enabled: Boolean,
    val filter: SmsFilter,
    val destination: ForwardDestination,
)

sealed class SmsFilter {
    data object All : SmsFilter()
    data class Sender(val patterns: List<String>) : SmsFilter()
    data class Content(val keywords: List<String>) : SmsFilter()
    data class SenderAndContent(val patterns: List<String>, val keywords: List<String>) : SmsFilter()
}

sealed class ForwardDestination {
    data class Telegram(val botToken: String, val chatId: String, val silent: Boolean = false) : ForwardDestination()
    data class Webhook(val url: String, val method: String = "POST", val headers: List<HttpHeader> = emptyList()) : ForwardDestination()
    data class Sms(val forwardNumber: String) : ForwardDestination()
    data class Ntfy(val url: String, val topic: String, val token: String? = null) : ForwardDestination()
    data class Discord(val webhookUrl: String) : ForwardDestination()
    data class Slack(val webhookUrl: String) : ForwardDestination()
}

data class HttpHeader(val name: String, val value: String)

data class ForwardLogEntry(
    val timestamp: Long,
    val smsId: Long,
    val sender: String,
    val contentPreview: String,
    val ruleName: String,
    val destinationType: String,
    val success: Boolean,
    val error: String? = null,
)

object SMSForwardParser {

    fun parseConfig(data: Map<String, Any?>): SmsForwardConfig {
        val configMap = data["config"] as? Map<*, *> ?: return SmsForwardConfig()
        val rulesList = configMap["rules"] as? List<*> ?: emptyList<Any>()
        val rules = rulesList.mapNotNull { item ->
            val map = item as? Map<*, *> ?: return@mapNotNull null
            @Suppress("UNCHECKED_CAST")
            parseRule(map as Map<String, Any?>)
        }
        return SmsForwardConfig(
            enabled = DeviceParser.asBool(configMap["enabled"]),
            pollIntervalSecs = DeviceParser.asLong(configMap["poll_interval_secs"]) ?: 30,
            markReadAfterForward = DeviceParser.asBool(configMap["mark_read_after_forward"]),
            deleteAfterForward = DeviceParser.asBool(configMap["delete_after_forward"]),
            rules = rules,
        )
    }

    fun parseRule(data: Map<String, Any?>): ForwardRule? {
        val id = DeviceParser.asInt(data["id"]) ?: return null
        val name = data["name"] as? String ?: return null
        val enabled = data["enabled"] as? Boolean ?: return null
        val filterMap = data["filter"] as? Map<*, *> ?: return null
        val destMap = data["destination"] as? Map<*, *> ?: return null
        @Suppress("UNCHECKED_CAST")
        val filter = parseFilter(filterMap as Map<String, Any?>)
        @Suppress("UNCHECKED_CAST")
        val destination = parseDestination(destMap as Map<String, Any?>) ?: return null
        return ForwardRule(
            id = id,
            name = name,
            enabled = enabled,
            filter = filter,
            destination = destination,
        )
    }

    fun parseFilter(data: Map<String, Any?>): SmsFilter {
        return when (data["type"] as? String) {
            "sender" -> {
                val patterns = (data["patterns"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
                SmsFilter.Sender(patterns)
            }
            "content" -> {
                val keywords = (data["keywords"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
                SmsFilter.Content(keywords)
            }
            "sender_and_content" -> {
                val patterns = (data["patterns"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
                val keywords = (data["keywords"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
                SmsFilter.SenderAndContent(patterns, keywords)
            }
            else -> SmsFilter.All
        }
    }

    fun parseDestination(data: Map<String, Any?>): ForwardDestination? {
        return when (data["type"] as? String) {
            "telegram" -> ForwardDestination.Telegram(
                botToken = data["bot_token"] as? String ?: return null,
                chatId = data["chat_id"] as? String ?: return null,
                silent = DeviceParser.asBool(data["silent"]),
            )
            "webhook" -> {
                val headersList = (data["headers"] as? List<*>)?.mapNotNull { item ->
                    val map = item as? Map<*, *> ?: return@mapNotNull null
                    val name = map["name"] as? String ?: return@mapNotNull null
                    val value = map["value"] as? String ?: return@mapNotNull null
                    HttpHeader(name, value)
                } ?: emptyList()
                ForwardDestination.Webhook(
                    url = data["url"] as? String ?: return null,
                    method = data["method"] as? String ?: "POST",
                    headers = headersList,
                )
            }
            "sms" -> ForwardDestination.Sms(
                forwardNumber = data["forward_number"] as? String ?: return null,
            )
            "ntfy" -> ForwardDestination.Ntfy(
                url = data["url"] as? String ?: return null,
                topic = data["topic"] as? String ?: return null,
                token = data["token"] as? String,
            )
            "discord" -> ForwardDestination.Discord(
                webhookUrl = data["webhook_url"] as? String ?: return null,
            )
            "slack" -> ForwardDestination.Slack(
                webhookUrl = data["webhook_url"] as? String ?: return null,
            )
            else -> null
        }
    }

    fun parseLogEntry(data: Map<String, Any?>): ForwardLogEntry? {
        val timestamp = DeviceParser.asLong(data["timestamp"]) ?: return null
        val smsId = DeviceParser.asLong(data["sms_id"]) ?: return null
        return ForwardLogEntry(
            timestamp = timestamp,
            smsId = smsId,
            sender = data["sender"] as? String ?: "",
            contentPreview = data["content_preview"] as? String ?: "",
            ruleName = data["rule_name"] as? String ?: "",
            destinationType = data["destination_type"] as? String ?: "",
            success = data["success"] as? Boolean ?: false,
            error = data["error"] as? String,
        )
    }

    fun filterToMap(filter: SmsFilter): Map<String, Any?> {
        return when (filter) {
            is SmsFilter.All -> mapOf("type" to "all")
            is SmsFilter.Sender -> mapOf("type" to "sender", "patterns" to filter.patterns)
            is SmsFilter.Content -> mapOf("type" to "content", "keywords" to filter.keywords)
            is SmsFilter.SenderAndContent -> mapOf(
                "type" to "sender_and_content",
                "patterns" to filter.patterns,
                "keywords" to filter.keywords,
            )
        }
    }

    fun destinationToMap(dest: ForwardDestination): Map<String, Any?> {
        return when (dest) {
            is ForwardDestination.Telegram -> mapOf(
                "type" to "telegram",
                "bot_token" to dest.botToken,
                "chat_id" to dest.chatId,
                "silent" to dest.silent,
            )
            is ForwardDestination.Webhook -> mapOf(
                "type" to "webhook",
                "url" to dest.url,
                "method" to dest.method,
                "headers" to dest.headers.map { mapOf("name" to it.name, "value" to it.value) },
            )
            is ForwardDestination.Sms -> mapOf(
                "type" to "sms",
                "forward_number" to dest.forwardNumber,
            )
            is ForwardDestination.Ntfy -> buildMap {
                put("type", "ntfy")
                put("url", dest.url)
                put("topic", dest.topic)
                if (dest.token != null) put("token", dest.token)
            }
            is ForwardDestination.Discord -> mapOf(
                "type" to "discord",
                "webhook_url" to dest.webhookUrl,
            )
            is ForwardDestination.Slack -> mapOf(
                "type" to "slack",
                "webhook_url" to dest.webhookUrl,
            )
        }
    }
}
