//! Read our literal startup assignments without executing a saved shell script.
use crate::model::{InstallRequest, InstallerError, PasswordAction, PinAction};

pub struct Credentials {
    pub password: String,
    pub pin: String,
}

fn invalid() -> InstallerError {
    InstallerError::new(
        "Existing dashboard credentials could not be preserved",
        "Choose a new dashboard password and explicitly set or remove the PIN, then check again.",
        "The saved startup script has missing, ambiguous or unsupported credential assignments.",
    )
}

fn literal_assignment(script: &str, name: &str) -> Result<Option<String>, InstallerError> {
    let prefix = format!("export {name}=");
    let mut matches = script
        .match_indices(&prefix)
        .filter(|(offset, _)| *offset == 0 || script.as_bytes()[offset - 1] == b'\n');
    let Some((offset, _)) = matches.next() else {
        return Ok(None);
    };
    if matches.next().is_some() {
        return Err(invalid());
    }
    let mut chars = script[offset + prefix.len()..].chars().peekable();
    let mut value = String::new();
    while let Some(c) = chars.next() {
        match c {
            '\'' => loop {
                match chars.next() {
                    Some('\'') => break,
                    Some(c) => value.push(c),
                    None => return Err(invalid()),
                }
            },
            '"' => {
                // shell_quote escapes an embedded apostrophe with "'".
                if chars.next() != Some('\'') || chars.next() != Some('"') {
                    return Err(invalid());
                }
                value.push('\'');
            }
            '\n' | '\r' => break,
            c if c.is_ascii_alphanumeric() || "_-@.!+/=".contains(c) => value.push(c),
            _ => return Err(invalid()),
        }
    }
    if value.contains('\0') {
        return Err(invalid());
    }
    Ok(Some(value))
}

pub fn resolve(request: &InstallRequest, script: &str) -> Result<Credentials, InstallerError> {
    let password = match request.password_action {
        PasswordAction::Replace => request.agent_password.clone(),
        PasswordAction::Keep => literal_assignment(script, "ZTE_AGENT_PASSWORD")?
            .filter(|v| !v.is_empty())
            .ok_or_else(invalid)?,
    };
    let pin = match request.pin_action {
        PinAction::Set => request.agent_pin.clone(),
        PinAction::Remove => String::new(),
        PinAction::Keep => {
            literal_assignment(script, "ZTE_AGENT_PASSWORD")?
                .filter(|value| !value.is_empty())
                .ok_or_else(invalid)?;
            let pin = literal_assignment(script, "ZTE_AGENT_PIN")?;
            let unset = script.lines().any(|line| line == "unset ZTE_AGENT_PIN");
            match (pin, unset) {
                (Some(_), true) => return Err(invalid()),
                (Some(pin), false) => pin,
                (None, _) => String::new(),
            }
        }
    };
    if password.is_empty()
        || (!pin.is_empty() && (pin.len() != 6 || !pin.bytes().all(|b| b.is_ascii_digit())))
    {
        return Err(invalid());
    }
    Ok(Credentials { password, pin })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserve_change_and_remove_are_independent() {
        let script =
            "export ZTE_AGENT_PASSWORD='existing-password'\nexport ZTE_AGENT_PIN='123456'\n";
        let mut request = crate::model::sample_request();
        request.password_action = PasswordAction::Keep;
        request.pin_action = PinAction::Keep;
        let kept = resolve(&request, script).unwrap();
        assert_eq!(kept.password, "existing-password");
        assert_eq!(kept.pin, "123456");
        request.password_action = PasswordAction::Replace;
        assert_eq!(resolve(&request, script).unwrap().pin, "123456");
        request.pin_action = PinAction::Remove;
        assert!(resolve(&request, script).unwrap().pin.is_empty());
        request.password_action = PasswordAction::Keep;
        assert!(resolve(&request, "").is_err());
    }
    #[test]
    fn reads_literal_quotes_and_multiline_without_shell_evaluation() {
        assert_eq!(
            literal_assignment("export SECRET='a'\"'\"'b\n$(not-executed)'\n", "SECRET")
                .unwrap()
                .as_deref(),
            Some("a'b\n$(not-executed)")
        );
        assert!(literal_assignment("export SECRET=$(command)\n", "SECRET").is_err());
        assert!(literal_assignment("export SECRET='x'\nexport SECRET='y'\n", "SECRET").is_err());
        assert!(literal_assignment("export SECRET='unterminated", "SECRET").is_err());
    }
}
