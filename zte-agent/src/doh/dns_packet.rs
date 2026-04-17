/// Validate that buf is a DNS query (QR=0, QDCOUNT>=1, len>=12).
pub fn is_valid_query(buf: &[u8]) -> bool {
    if buf.len() < 12 {
        return false;
    }
    // QR bit is the high bit of byte 2
    if buf[2] & 0x80 != 0 {
        return false;
    }
    // QDCOUNT in bytes 4-5
    let qdcount = u16::from_be_bytes([buf[4], buf[5]]);
    qdcount >= 1
}

/// Parse the first question from a DNS packet.
/// Returns (qname_lowercase, qtype, offset_after_question).
pub fn parse_question(buf: &[u8]) -> Option<(String, u16, usize)> {
    if buf.len() < 12 {
        return None;
    }
    let mut pos = 12; // skip header
    let mut name_parts: Vec<String> = Vec::new();

    loop {
        if pos >= buf.len() {
            return None;
        }
        let label_len = buf[pos] as usize;
        pos += 1;
        if label_len == 0 {
            break;
        }
        // Compression pointer — shouldn't appear in question section of a standard query,
        // but handle gracefully
        if label_len & 0xC0 == 0xC0 {
            return None;
        }
        if pos + label_len > buf.len() {
            return None;
        }
        let label = std::str::from_utf8(&buf[pos..pos + label_len]).ok()?;
        name_parts.push(label.to_ascii_lowercase());
        pos += label_len;
    }

    // Need 4 more bytes for qtype + qclass
    if pos + 4 > buf.len() {
        return None;
    }
    let qtype = u16::from_be_bytes([buf[pos], buf[pos + 1]]);
    // skip qclass (2 bytes)
    pos += 4;

    let qname = name_parts.join(".");
    Some((qname, qtype, pos))
}

/// Extract the minimum TTL from answer/authority/additional RRs.
/// Returns 0 if no RRs found or parse error.
pub fn extract_min_ttl(buf: &[u8]) -> u32 {
    extract_min_ttl_inner(buf).unwrap_or(0)
}

fn extract_min_ttl_inner(buf: &[u8]) -> Option<u32> {
    if buf.len() < 12 {
        return Some(0);
    }

    let ancount = u16::from_be_bytes([buf[6], buf[7]]) as usize;
    let nscount = u16::from_be_bytes([buf[8], buf[9]]) as usize;
    let arcount = u16::from_be_bytes([buf[10], buf[11]]) as usize;
    let total_rrs = ancount + nscount + arcount;

    if total_rrs == 0 {
        return Some(0);
    }

    // Skip question section
    let mut pos = 12;
    let qdcount = u16::from_be_bytes([buf[4], buf[5]]) as usize;
    for _ in 0..qdcount {
        pos = skip_name(buf, pos)?;
        pos += 4; // qtype + qclass
        if pos > buf.len() {
            return Some(0);
        }
    }

    let mut min_ttl = u32::MAX;

    for _ in 0..total_rrs {
        // Skip name (may have compression pointers)
        pos = skip_name(buf, pos)?;
        // type(2) + class(2) + ttl(4) + rdlength(2) = 10
        if pos + 10 > buf.len() {
            break;
        }
        let ttl = u32::from_be_bytes([buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]]);
        let rdlength = u16::from_be_bytes([buf[pos + 8], buf[pos + 9]]) as usize;
        pos += 10 + rdlength;
        if pos > buf.len() {
            break;
        }
        if ttl < min_ttl {
            min_ttl = ttl;
        }
    }

    Some(if min_ttl == u32::MAX { 0 } else { min_ttl })
}

/// Rewrite the transaction ID (bytes 0-1) of a DNS packet.
pub fn rewrite_id(buf: &mut [u8], id: u16) {
    if buf.len() >= 2 {
        let bytes = id.to_be_bytes();
        buf[0] = bytes[0];
        buf[1] = bytes[1];
    }
}

/// Skip a DNS name (handling compression pointers). Returns position after the name,
/// or None on error (returned as 0 via the `?` trait impl below).
fn skip_name(buf: &[u8], mut pos: usize) -> Option<usize> {
    // Limit iterations to prevent infinite loops
    for _ in 0..128 {
        if pos >= buf.len() {
            return None;
        }
        let b = buf[pos];
        if b == 0 {
            return Some(pos + 1);
        }
        if b & 0xC0 == 0xC0 {
            // Compression pointer — 2 bytes, name ends here
            return Some(pos + 2);
        }
        let label_len = b as usize;
        pos += 1 + label_len;
    }
    None
}
