# Security Policy

## Scope

This policy applies to the open-u60-pro toolkit code (zte-agent, iOS app, Android app). It does **not** cover ZTE firmware or hardware vulnerabilities — please report those directly to ZTE.

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do not** open a public GitHub issue.
2. Email **jesthersilvestre@yahoo.com** with:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. You will receive an acknowledgement within 72 hours.
4. A fix will be developed privately and disclosed once a patch is available.

## Supported Versions

Only the latest release on the `main` branch is actively supported with security updates.

## Security Considerations

- `zte-agent` binds to `0.0.0.0:9090` on the device LAN — it is intended for local network use only and should not be exposed to the internet.
- No authentication is implemented by default; the agent trusts all clients on the local network.
- SSH credentials and device access tokens should never be committed to the repository.
