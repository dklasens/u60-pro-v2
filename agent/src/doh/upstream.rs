use std::time::Duration;

pub fn query_doh(dns_query: &[u8], url: &str, timeout: Duration) -> Result<Vec<u8>, String> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(timeout))
        .build()
        .into();

    let mut response = agent
        .post(url)
        .header("Content-Type", "application/dns-message")
        .header("Accept", "application/dns-message")
        .send(dns_query)
        .map_err(|e| format!("DoH request failed: {e}"))?;

    let body = response
        .body_mut()
        .read_to_vec()
        .map_err(|e| format!("DoH read failed: {e}"))?;
    Ok(body)
}
