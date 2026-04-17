package com.openu60.core.model

import java.text.SimpleDateFormat
import java.util.*

data class SchedulerJob(
    val id: Int,
    val name: String,
    val enabled: Boolean,
    val scheduleType: String,
    val scheduleTime: String? = null,
    val scheduleDays: List<Int> = emptyList(),
    val scheduleAt: Int? = null,
    val actionMethod: String,
    val actionPath: String,
    val restoreTime: String? = null,
    val lastRun: Int? = null,
    val lastStatus: Int? = null,
    val lastError: String? = null,
    val lastRestore: Int? = null,
    val createdAt: Int = 0,
) {
    val scheduleSummary: String
        get() = when (scheduleType) {
            "recurring" -> {
                val time = scheduleTime ?: "??:??"
                val dayNames = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
                val dayStr = when {
                    scheduleDays.size == 7 -> "Every day"
                    scheduleDays == listOf(0, 1, 2, 3, 4) -> "Mon\u2013Fri"
                    scheduleDays == listOf(5, 6) -> "Weekends"
                    else -> scheduleDays.mapNotNull { dayNames.getOrNull(it) }.joinToString(", ")
                }
                if (restoreTime != null) "$dayStr at $time \u2192 $restoreTime"
                else "$dayStr at $time"
            }
            "once" -> {
                if (scheduleAt != null) {
                    val date = Date(scheduleAt.toLong() * 1000)
                    val fmt = SimpleDateFormat("MMM d, yyyy HH:mm", Locale.getDefault())
                    "Once: ${fmt.format(date)}"
                } else "One-time"
            }
            else -> scheduleType
        }

    val actionSummary: String
        get() = ActionTemplate.from(actionMethod, actionPath)?.label
            ?: "$actionMethod $actionPath"

    companion object {
        fun parse(dict: Map<String, Any?>): SchedulerJob? {
            val id = DeviceParser.asInt(dict["id"]) ?: return null
            val name = dict["name"] as? String ?: return null
            val enabled = dict["enabled"] as? Boolean ?: return null
            val schedule = dict["schedule"] as? Map<*, *> ?: return null
            val scheduleType = schedule["type"] as? String ?: return null
            val action = dict["action"] as? Map<*, *> ?: return null
            val method = action["method"] as? String ?: return null
            val path = action["path"] as? String ?: return null
            val restore = dict["restore"] as? Map<*, *>

            return SchedulerJob(
                id = id,
                name = name,
                enabled = enabled,
                scheduleType = scheduleType,
                scheduleTime = schedule["time"] as? String,
                scheduleDays = (schedule["days"] as? List<*>)?.mapNotNull { DeviceParser.asInt(it) } ?: emptyList(),
                scheduleAt = DeviceParser.asInt(schedule["at"]),
                actionMethod = method,
                actionPath = path,
                restoreTime = restore?.get("time") as? String,
                lastRun = DeviceParser.asInt(dict["last_run"]),
                lastStatus = DeviceParser.asInt(dict["last_status"]),
                lastError = dict["last_error"] as? String,
                lastRestore = DeviceParser.asInt(dict["last_restore"]),
                createdAt = DeviceParser.asInt(dict["created_at"]) ?: 0,
            )
        }
    }
}

enum class ActionTemplate(val label: String, val method: String, val path: String) {
    AIRPLANE_ON("Airplane Mode ON", "POST", "/api/modem/airplane"),
    MOBILE_DATA_OFF("Mobile Data OFF", "PUT", "/api/modem/data"),
    GUEST_WIFI_OFF("Guest WiFi OFF", "PUT", "/api/wifi/guest"),
    REBOOT("Reboot", "POST", "/api/device/reboot"),
    POWER_SAVE_ON("Power Save ON", "PUT", "/api/device/power-save");

    val actionBody: Map<String, Any?>?
        get() = when (this) {
            AIRPLANE_ON -> mapOf("operate_mode" to "LPM")
            MOBILE_DATA_OFF -> mapOf("cid" to 1, "enable" to 0, "connect_status" to "disconnected")
            GUEST_WIFI_OFF -> mapOf("guest_disabled_2g" to "1", "guest_disabled_5g" to "1")
            REBOOT -> null
            POWER_SAVE_ON -> mapOf("deviceInfoList" to mapOf("power_saver_mode" to "1"))
        }

    val restoreBody: Map<String, Any?>?
        get() = when (this) {
            AIRPLANE_ON -> mapOf("operate_mode" to "ONLINE")
            MOBILE_DATA_OFF -> mapOf("cid" to 1, "enable" to 1)
            GUEST_WIFI_OFF -> mapOf("guest_disabled_2g" to "0", "guest_disabled_5g" to "0")
            REBOOT -> null
            POWER_SAVE_ON -> mapOf("deviceInfoList" to mapOf("power_saver_mode" to "0"))
        }

    val supportsRestore: Boolean get() = this != REBOOT

    companion object {
        fun from(method: String, path: String): ActionTemplate? =
            entries.firstOrNull { it.method == method && it.path == path }
    }
}
