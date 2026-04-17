import Foundation

struct SIMInfo: Equatable {
    var iccid: String = ""
    var imsi: String = ""
    var msisdn: String = ""
    var spn: String = ""
    var mcc: String = ""
    var mnc: String = ""
    var simStatus: String = ""
    var operatorName: String = ""
    var currentSlot: String = ""
    var pinStatus: String = ""
    var pinAttempts: Int = 0
    var pukAttempts: Int = 0
    var provisionState: String = ""
    var modemMainState: String = ""

    static let empty = SIMInfo()
}

struct SIMLockInfo: Equatable {
    var availableTrials: Int = 0

    static let empty = SIMLockInfo()
}

enum SIMParser {
    static func parseSIMInfo(_ data: [String: Any]) -> SIMInfo {
        var info = SIMInfo()
        info.iccid = data["sim_iccid"] as? String ?? ""
        info.imsi = data["sim_imsi"] as? String ?? ""
        info.msisdn = data["msisdn"] as? String ?? ""
        info.mcc = data["mdm_mcc"] as? String ?? ""
        info.mnc = data["mdm_mnc"] as? String ?? ""
        info.simStatus = data["sim_states"] as? String ?? ""
        info.operatorName = data["Operator"] as? String ?? ""
        info.currentSlot = data["current_sim_slot"] as? String ?? ""
        info.pinStatus = data["pin_status"] as? String ?? ""
        info.pinAttempts = asInt(data["pinnumber"]) ?? 0
        info.pukAttempts = asInt(data["puknumber"]) ?? 0
        info.provisionState = data["sim1_provision_state"] as? String ?? ""
        info.modemMainState = data["modem_main_state"] as? String ?? ""
        if let spnHex = data["spn_name_data"] as? String {
            info.spn = DeviceParser.decodeSpn(spnHex)
        }
        return info
    }

    static func parseSIMLock(_ data: [String: Any]) -> SIMLockInfo {
        SIMLockInfo(availableTrials: asInt(data["available_trials"]) ?? 0)
    }

    private static func asInt(_ val: Any?) -> Int? {
        if let i = val as? Int { return i }
        if let s = val as? String { return Int(s) }
        if let d = val as? Double { return Int(d) }
        return nil
    }
}
