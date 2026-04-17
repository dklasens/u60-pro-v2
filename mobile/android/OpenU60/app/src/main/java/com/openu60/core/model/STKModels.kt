package com.openu60.core.model

data class STKMenuItem(
    val id: Int,
    val label: String,
)

data class STKMenu(
    val title: String = "",
    val items: List<STKMenuItem> = emptyList(),
    val source: String = "",
) {
    companion object {
        val empty = STKMenu()
    }
}

data class USSDResponse(
    val response: String = "",
    val rawResponse: String = "",
    val status: Int = -1,
    val dcs: Int = 15,
    val sessionActive: Boolean = false,
) {
    companion object {
        val empty = USSDResponse()
    }
}

object STKParser {
    fun parseSTKMenu(data: Map<String, Any?>): STKMenu {
        val title = data["title"] as? String ?: ""
        val source = data["source"] as? String ?: ""
        val itemsList = data["items"] as? List<*> ?: emptyList<Any>()
        val items = itemsList.mapNotNull { item ->
            val map = item as? Map<*, *> ?: return@mapNotNull null
            val label = map["label"] as? String ?: return@mapNotNull null
            val id = DeviceParser.asInt(map["id"]) ?: 0
            STKMenuItem(id = id, label = label)
        }
        return STKMenu(title = title, items = items, source = source)
    }

    fun parseUSSDResponse(data: Map<String, Any?>): USSDResponse {
        return USSDResponse(
            response = data["response"] as? String ?: "",
            rawResponse = data["raw_response"] as? String ?: "",
            status = DeviceParser.asInt(data["status"]) ?: -1,
            dcs = DeviceParser.asInt(data["dcs"]) ?: 15,
            sessionActive = data["session_active"] as? Boolean ?: false,
        )
    }

    fun parseError(data: Map<String, Any?>): String? {
        return data["error"] as? String
    }
}
