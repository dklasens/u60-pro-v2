package com.openu60.core.model

data class SIMInfo(
    val iccid: String = "",
    val imsi: String = "",
    val msisdn: String = "",
    val spn: String = "",
    val mcc: String = "",
    val mnc: String = "",
    val simStatus: String = "",
    val operatorName: String = "",
    val currentSlot: String = "",
    val pinStatus: String = "",
    val pinAttempts: Int = 0,
    val pukAttempts: Int = 0,
    val provisionState: String = "",
    val modemMainState: String = "",
) {
    companion object {
        val empty = SIMInfo()
    }
}

data class SIMLockInfo(
    val availableTrials: Int = 0,
) {
    companion object {
        val empty = SIMLockInfo()
    }
}

object SIMParser {
    fun parseSIMInfo(data: Map<String, Any?>): SIMInfo {
        val spnHex = data["spn_name_data"] as? String
        val spn = if (spnHex != null) DeviceParser.decodeSpn(spnHex) else ""
        return SIMInfo(
            iccid = data["sim_iccid"] as? String ?: "",
            imsi = data["sim_imsi"] as? String ?: "",
            msisdn = data["msisdn"] as? String ?: "",
            spn = spn,
            mcc = data["mdm_mcc"] as? String ?: "",
            mnc = data["mdm_mnc"] as? String ?: "",
            simStatus = data["sim_states"] as? String ?: "",
            operatorName = data["Operator"] as? String ?: "",
            currentSlot = data["current_sim_slot"] as? String ?: "",
            pinStatus = data["pin_status"] as? String ?: "",
            pinAttempts = DeviceParser.asInt(data["pinnumber"]) ?: 0,
            pukAttempts = DeviceParser.asInt(data["puknumber"]) ?: 0,
            provisionState = data["sim1_provision_state"] as? String ?: "",
            modemMainState = data["modem_main_state"] as? String ?: "",
        )
    }

    fun parseSIMLock(data: Map<String, Any?>): SIMLockInfo {
        return SIMLockInfo(availableTrials = DeviceParser.asInt(data["available_trials"]) ?: 0)
    }
}
