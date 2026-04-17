import Foundation

struct NRSignal: Equatable {
    var rsrp: Double?
    var rsrq: Double?
    var sinr: Double?
    var rssi: Double?
    var band: String = ""
    var pci: String = ""
    var cellID: String = ""
    var channel: String = ""
    var bandwidth: String = ""
    var carrierAggregation: String = ""
    var sccCarriers: [LTECarrier] = []

    static let empty = NRSignal()

    var isConnected: Bool { rsrp != nil }

    var hasSignal: Bool {
        isConnected || sccCarriers.contains(where: { $0.rsrp != nil })
    }
}

struct LTECarrier: Equatable, Identifiable {
    var id: String { "\(label)-\(band)-\(pci)-\(earfcn)" }
    var label: String = ""
    var pci: String = ""
    var band: String = ""
    var earfcn: String = ""
    var bandwidth: String = ""
    var rsrp: Double?
    var rsrq: Double?
    var sinr: Double?
    var rssi: Double?
}

struct LTESignal: Equatable {
    var rsrp: Double?
    var rsrq: Double?
    var sinr: Double?
    var rssi: Double?
    var pci: String = ""
    var band: String = ""
    var earfcn: String = ""
    var bandwidth: String = ""
    var cellID: String = ""
    var carrierAggregation: String = ""
    var caState: String = ""
    var sccCarriers: [LTECarrier] = []

    static let empty = LTESignal()

    var isConnected: Bool { rsrp != nil }

    var hasSignal: Bool {
        isConnected || sccCarriers.contains(where: { $0.rsrp != nil })
    }
}

struct WCDMASignal: Equatable {
    var rscp: Double?
    var ecio: Double?

    static let empty = WCDMASignal()

    var isConnected: Bool { rscp != nil }
}

struct OperatorInfo: Equatable {
    var provider: String = ""
    var networkType: String = ""
    var signalBar: Int = 0
    var roaming: Bool = false

    static let empty = OperatorInfo()

    enum NetworkMode: Equatable {
        case sa, nsa, lte, legacy, unknown
    }

    var networkMode: NetworkMode {
        let raw = networkType.uppercased()
        if raw == "SA" || raw == "5G SA" || raw.contains("NR SA") { return .sa }
        if raw == "NSA" || raw == "ENDC" || raw == "EN-DC" || raw.contains("NR NSA") { return .nsa }
        if raw.contains("LTE") || raw == "4G" || raw == "4G+" { return .lte }
        if raw.contains("WCDMA") || raw.contains("UMTS") || raw.contains("GSM")
            || raw.contains("2G") || raw.contains("3G") { return .legacy }
        return .unknown
    }

    func displayNetworkType(nrConnected: Bool, lteSignal: LTESignal = .empty) -> String {
        // Firmware says LTE but NR is actually connected → 5G NSA
        if nrConnected && (networkMode == .lte || networkMode == .unknown) {
            return "5G NSA"
        }
        // Firmware still says SA/NSA but NR has dropped → fall back to 4G
        if !nrConnected && (networkMode == .sa || networkMode == .nsa) {
            if lteSignal.isConnected {
                return lteSignal.sccCarriers.isEmpty ? "4G" : "4G+"
            }
            return "4G"
        }
        switch networkMode {
        case .sa: return "5G SA"
        case .nsa: return "5G NSA"
        case .lte:
            let raw = networkType.uppercased()
            return (raw.contains("CA") || raw == "4G+" || raw.contains("LTE-A") || raw.contains("LTE+"))
                ? "4G+" : "4G"
        case .legacy: return networkType
        case .unknown: return networkType
        }
    }

    func showNR(nr: NRSignal) -> Bool {
        nr.hasSignal
    }

    func showLTE(lte: LTESignal) -> Bool {
        if networkMode == .sa { return false }
        let raw = networkType.uppercased()
        let hasData = lte.hasSignal
        let actHintsLTE = raw.contains("NSA") || raw.contains("LTE") || raw.contains("E-UTRAN")
            || raw.contains("ENDC") || raw.contains("EN-DC") || raw == "4G" || raw == "4G+"
        let actHintsNR = raw.contains("SA") || raw.contains("NR") || raw.contains("5G")
            || raw.contains("ENDC") || raw.contains("EN-DC")
        return hasData && (actHintsLTE || raw.isEmpty || actHintsNR)
    }

    func show3G(nr: NRSignal, lte: LTESignal, wcdma: WCDMASignal) -> Bool {
        !showNR(nr: nr) && !showLTE(lte: lte) && (wcdma.rscp != nil || wcdma.ecio != nil)
    }
}

struct SignalSnapshot: Identifiable, Equatable {
    private static var nextID: Int = 0
    let id: Int
    let timestamp: Date
    let nrRSRP: Double?
    let lteRSRP: Double?

    init(timestamp: Date, nrRSRP: Double?, lteRSRP: Double?) {
        self.id = Self.nextID
        Self.nextID += 1
        self.timestamp = timestamp
        self.nrRSRP = nrRSRP
        self.lteRSRP = lteRSRP
    }
}

/// Parser that extracts signal data from the agent nwinfo_get_netinfo response.
enum SignalParser {
    static func parseNetInfo(_ data: [String: Any]) -> (NRSignal, LTESignal, WCDMASignal, OperatorInfo) {
        var nr = NRSignal()
        var lte = LTESignal()
        var wcdma = WCDMASignal()
        var op = OperatorInfo()

        nr.rsrp = parseDouble(data["nr5g_rsrp"]).flatMap { $0 == 0 ? nil : $0 }
        nr.rsrq = parseDouble(data["nr5g_rsrq"])
        nr.sinr = parseDouble(data["nr5g_snr"])
        nr.rssi = parseDouble(data["nr5g_rssi"])
        nr.band = stringVal(data["nr5g_action_band"])
        nr.pci = stringVal(data["nr5g_pci"])
        nr.cellID = stringVal(data["nr5g_cell_id"])
        nr.channel = stringVal(data["nr5g_action_channel"])
        nr.bandwidth = stringVal(data["nr5g_bandwidth"])
        nr.carrierAggregation = stringVal(data["nrca"])

        // Parse nrca: "PCI,Band,Index,EARFCN,BW;..." — same format as lteca
        let nrcaStr = stringVal(data["nrca"])
        var nrCarriers: [(pci: String, band: String, earfcn: String, bandwidth: String)] = []
        for entry in nrcaStr.trimmingCharacters(in: CharacterSet(charactersIn: ";")).split(separator: ";") {
            let parts = entry.split(separator: ",").map(String.init)
            if parts.count >= 5 {
                nrCarriers.append((pci: parts[0], band: parts[1], earfcn: parts[3], bandwidth: parts[4]))
            }
        }

        // Parse nrcasig: "RSRP,RSRQ,SINR,RSSI,...;..."
        let nrcasigStr = stringVal(data["nrcasig"])
        var nrSccSigs: [(rsrp: Double?, rsrq: Double?, sinr: Double?, rssi: Double?)] = []
        for entry in nrcasigStr.trimmingCharacters(in: CharacterSet(charactersIn: ";")).split(separator: ";") {
            let parts = entry.split(separator: ",").map(String.init)
            if parts.count >= 4 {
                nrSccSigs.append((
                    rsrp: Double(parts[0].trimmingCharacters(in: .whitespaces)),
                    rsrq: Double(parts[1].trimmingCharacters(in: .whitespaces)),
                    sinr: Double(parts[2].trimmingCharacters(in: .whitespaces)),
                    rssi: Double(parts[3].trimmingCharacters(in: .whitespaces))
                ))
            }
        }

        // Match NR PCC by PCI+channel, remainder = SCCs
        let nrPccPci = nr.pci
        let nrPccChannel = nr.channel
        var nrSccEntries: [(pci: String, band: String, earfcn: String, bandwidth: String)] = []
        var nrPccFound = false
        for c in nrCarriers {
            if !nrPccFound && c.pci == nrPccPci && c.earfcn == nrPccChannel && !nrPccPci.isEmpty {
                if !c.bandwidth.isEmpty { nr.bandwidth = c.bandwidth }
                nrPccFound = true
            } else {
                nrSccEntries.append(c)
            }
        }

        // Build NR SCC carriers with signals
        var nrSccCarriers: [LTECarrier] = []
        for (i, sc) in nrSccEntries.enumerated() {
            var carrier = LTECarrier(label: "5G SCC\(i)", pci: sc.pci, band: sc.band, earfcn: sc.earfcn, bandwidth: sc.bandwidth)
            if i < nrSccSigs.count {
                carrier.rsrp = nrSccSigs[i].rsrp
                carrier.rsrq = nrSccSigs[i].rsrq
                carrier.sinr = nrSccSigs[i].sinr
                carrier.rssi = nrSccSigs[i].rssi
            }
            nrSccCarriers.append(carrier)
        }
        nr.sccCarriers = nrSccCarriers

        let pccPci = stringVal(data["lte_pci"])
        let pccEarfcn = stringVal(data["wan_active_channel"])
        lte.rsrp = parseDouble(data["lte_rsrp"]).flatMap { $0 == 0 ? nil : $0 }
        lte.rsrq = parseDouble(data["lte_rsrq"])
        lte.sinr = parseDouble(data["lte_snr"])
        lte.rssi = parseDouble(data["lte_rssi"])
        lte.pci = pccPci
        lte.earfcn = pccEarfcn
        lte.band = stringVal(data["wan_active_band"])
        lte.cellID = stringVal(data["cell_id"])
        lte.caState = stringVal(data["lteca_state"])

        // Parse lteca: "PCI,Band,Index,EARFCN,BW;..."
        let ltecaStr = stringVal(data["lteca"])
        lte.carrierAggregation = ltecaStr
        var carriers: [(pci: String, band: String, earfcn: String, bandwidth: String)] = []
        for entry in ltecaStr.trimmingCharacters(in: CharacterSet(charactersIn: ";")).split(separator: ";") {
            let parts = entry.split(separator: ",").map(String.init)
            if parts.count >= 5 {
                carriers.append((pci: parts[0], band: parts[1], earfcn: parts[3], bandwidth: parts[4]))
            }
        }

        // Parse ltecasig: "RSRP,RSRQ,SINR,RSSI,...;..."
        let ltecasigStr = stringVal(data["ltecasig"])
        var sccSigs: [(rsrp: Double?, rsrq: Double?, sinr: Double?, rssi: Double?)] = []
        for entry in ltecasigStr.trimmingCharacters(in: CharacterSet(charactersIn: ";")).split(separator: ";") {
            let parts = entry.split(separator: ",").map(String.init)
            if parts.count >= 4 {
                sccSigs.append((
                    rsrp: Double(parts[0].trimmingCharacters(in: .whitespaces)),
                    rsrq: Double(parts[1].trimmingCharacters(in: .whitespaces)),
                    sinr: Double(parts[2].trimmingCharacters(in: .whitespaces)),
                    rssi: Double(parts[3].trimmingCharacters(in: .whitespaces))
                ))
            }
        }

        // Match PCC by PCI+EARFCN, remainder = SCCs
        var sccEntries: [(pci: String, band: String, earfcn: String, bandwidth: String)] = []
        var pccFound = false
        for c in carriers {
            if !pccFound && c.pci == pccPci && c.earfcn == pccEarfcn && !pccPci.isEmpty {
                if !c.bandwidth.isEmpty { lte.bandwidth = c.bandwidth }
                pccFound = true
            } else {
                sccEntries.append(c)
            }
        }

        // Build SCC carriers with signals
        var sccCarriers: [LTECarrier] = []
        for (i, sc) in sccEntries.enumerated() {
            var carrier = LTECarrier(label: "SCC\(i)", pci: sc.pci, band: sc.band, earfcn: sc.earfcn, bandwidth: sc.bandwidth)
            if i < sccSigs.count {
                carrier.rsrp = sccSigs[i].rsrp
                carrier.rsrq = sccSigs[i].rsrq
                carrier.sinr = sccSigs[i].sinr
                carrier.rssi = sccSigs[i].rssi
            }
            sccCarriers.append(carrier)
        }
        lte.sccCarriers = sccCarriers

        wcdma.rscp = parseDouble(data["rscp"]).flatMap { $0 == 0 ? nil : $0 }
        wcdma.ecio = parseDouble(data["ecio"])

        op.provider = stringVal(data["network_provider"])
        op.networkType = stringVal(data["network_type"])
        op.signalBar = Int(stringVal(data["signalbar"])) ?? 0
        op.roaming = stringVal(data["simcard_roam"]) == "1"

        return (nr, lte, wcdma, op)
    }

    private static func parseDouble(_ value: Any?) -> Double? {
        var result: Double?
        if let d = value as? Double { result = d }
        else if let i = value as? Int { result = Double(i) }
        else if let s = value as? String {
            let trimmed = s.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty || trimmed == "--" || trimmed == "N/A" { return nil }
            result = Double(trimmed)
        }
        if let r = result, r > 9000 || r < -9000 { return nil }
        return result
    }

    private static func stringVal(_ value: Any?) -> String {
        if let s = value as? String { return s }
        if let i = value as? Int { return String(i) }
        if let d = value as? Double { return String(d) }
        return ""
    }
}
