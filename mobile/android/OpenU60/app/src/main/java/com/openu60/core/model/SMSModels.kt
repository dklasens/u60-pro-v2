package com.openu60.core.model

import java.util.*

// MARK: - Tag Enum

enum class SMSTag(val value: Int) {
    READ(0), UNREAD(1), SENT(2), FAILED(3), DRAFT(4);

    val isIncoming: Boolean get() = this == READ || this == UNREAD

    companion object {
        fun fromInt(v: Int): SMSTag? = entries.firstOrNull { it.value == v }
    }
}

// MARK: - Storage Filter

enum class SMSStorageFilter(val memStoreValue: Int, val label: String) {
    ALL(2, "All"),
    INTERNAL(1, "Internal"),
    SIM(0, "SIM");
}

// MARK: - SMS Message

data class SMSMessage(
    val id: Int,
    val number: String,
    val content: String,
    val date: Date,
    val tag: SMSTag,
    val groupId: String,
    val memStore: String,
)

// MARK: - SMS Conversation

data class SMSConversation(
    val normalizedNumber: String,
    val number: String,
    val messages: List<SMSMessage>,
    val unreadCount: Int,
    val latestMessage: String,
    val latestTime: Date,
) {
    val id: String get() = normalizedNumber
}

// MARK: - SMS Capacity

data class SMSCapacity(
    val nvTotal: Int = 0,
    val nvUsed: Int = 0,
    val simTotal: Int = 0,
    val simUsed: Int = 0,
    val unreadCount: Int = 0,
) {
    companion object {
        val empty = SMSCapacity()
    }
}

// MARK: - Parser

object SMSParser {

    fun decodeUCS2Hex(hex: String): String {
        val sb = StringBuilder()
        val chars = hex.toCharArray()
        var i = 0
        while (i + 3 < chars.size) {
            val hexStr = String(chars, i, 4)
            val code = hexStr.toIntOrNull(16)
            if (code != null && code != 0) {
                sb.append(code.toChar())
            }
            i += 4
        }
        return sb.toString()
    }

    fun encodeUCS2Hex(text: String): String {
        return text.map { "%04X".format(it.code) }.joinToString("")
    }

    fun parseSMSDate(dateStr: String): Date {
        val parts = dateStr.split(",").map { it.trim() }
        if (parts.size < 6) return Date()

        val year = (parts[0].toIntOrNull() ?: 0) + 2000
        val month = (parts[1].toIntOrNull() ?: 1) - 1
        val day = parts[2].toIntOrNull() ?: 1
        val hour = parts[3].toIntOrNull() ?: 0
        val minute = parts[4].toIntOrNull() ?: 0
        val second = parts[5].toIntOrNull() ?: 0

        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        cal.set(year, month, day, hour, minute, second)
        cal.set(Calendar.MILLISECOND, 0)

        if (parts.size >= 7) {
            val tzStr = parts[6].trim()
            val quarters = tzStr.toIntOrNull()
            if (quarters != null) {
                val offsetMs = quarters * 15 * 60 * 1000
                cal.timeZone = TimeZone.getTimeZone("GMT")
                cal.add(Calendar.MILLISECOND, -offsetMs)
            }
        }

        return cal.time
    }

    fun formatSMSTime(): String {
        val cal = Calendar.getInstance()
        val year = cal.get(Calendar.YEAR) % 100
        val offsetHours = cal.timeZone.rawOffset / 3600000
        val tzStr = if (offsetHours >= 0) "+$offsetHours" else "$offsetHours"
        return "%02d;%02d;%02d;%02d;%02d;%02d;%s".format(
            year, cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH),
            cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE), cal.get(Calendar.SECOND), tzStr,
        )
    }

    fun getEncodeType(text: String): String {
        val gsm7 = "@£\$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ" +
            " !\"#¤%&'()*+,-./0123456789:;<=>?" +
            "¡ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
            "ÄÖÑÜabcdefghijklmnopqrstuvwxyz" +
            "äöñüà§"
        return if (text.all { it in gsm7 }) "GSM7_default" else "UNICODE"
    }

    fun normalizeNumber(number: String): String {
        val digits = number.filter { it.isDigit() }
        return if (digits.length > 8) digits.takeLast(8) else digits
    }

    fun groupIntoConversations(messages: List<SMSMessage>): List<SMSConversation> {
        val grouped = mutableMapOf<String, MutableList<SMSMessage>>()
        for (msg in messages) {
            val key = normalizeNumber(msg.number)
            grouped.getOrPut(key) { mutableListOf() }.add(msg)
        }
        return grouped.map { (key, msgs) ->
            val sorted = msgs.sortedBy { it.date }
            val latest = sorted.last()
            val unread = msgs.count { it.tag == SMSTag.UNREAD }
            val displayNumber = msgs.maxByOrNull { it.number.length }?.number ?: latest.number
            SMSConversation(
                normalizedNumber = key,
                number = displayNumber,
                messages = sorted,
                unreadCount = unread,
                latestMessage = latest.content,
                latestTime = latest.date,
            )
        }.sortedByDescending { it.latestTime }
    }

    fun parseMessages(data: Map<String, Any?>): List<SMSMessage> {
        val list = data["messages"] as? List<*> ?: return emptyList()
        return list.mapNotNull { item ->
            val map = item as? Map<*, *> ?: return@mapNotNull null
            val id = DeviceParser.asInt(map["id"]) ?: return@mapNotNull null
            val number = map["number"] as? String ?: return@mapNotNull null
            val body = map["content"] as? String ?: return@mapNotNull null
            val dateStr = map["date"] as? String ?: return@mapNotNull null
            val tagStr = map["tag"] as? String ?: return@mapNotNull null
            val tagInt = tagStr.toIntOrNull() ?: return@mapNotNull null
            val tag = SMSTag.fromInt(tagInt) ?: return@mapNotNull null

            val decoded = decodeUCS2Hex(body)
            val content = if (decoded.isEmpty()) body else decoded

            SMSMessage(
                id = id,
                number = number,
                content = content,
                date = parseSMSDate(dateStr),
                tag = tag,
                groupId = map["draft_group_id"] as? String ?: "",
                memStore = map["mem_store"] as? String ?: "nv",
            )
        }
    }

    fun parseCapacity(data: Map<String, Any?>): SMSCapacity {
        return SMSCapacity(
            nvTotal = DeviceParser.asInt(data["sms_nv_total"]) ?: 0,
            nvUsed = DeviceParser.asInt(data["sms_nvused_total"]) ?: 0,
            simTotal = DeviceParser.asInt(data["sms_sim_total"]) ?: 0,
            simUsed = DeviceParser.asInt(data["sms_simused_total"]) ?: 0,
            unreadCount = DeviceParser.asInt(data["sms_dev_unread_num"]) ?: 0,
        )
    }
}
