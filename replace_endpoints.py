import os

directory = '/Users/davidklasens/Documents/Dev/open-u60-pro-2.0.0-gem/mobile/android/OpenU60/app/src/main/java/com/openu60/feature/'

replacements = [
    ('/api/network/dns', '/api/router/dns'),
    ('agentClient.postJSON("/api/doh")', 'agentClient.postJSON("/api/doh/enable")'),
    ('agentClient.deleteJSON("/api/doh")', 'agentClient.postJSON("/api/doh/disable")'),
    ('/api/firewall/domain-filter', '/api/router/domain-filter'),
    ('/api/vpn/passthrough', '/api/router/vpn'),
    ('/api/network/qos', '/api/router/qos'),
    ('/api/network/lan', '/api/router/lan'),
    ('agentClient.getJSON("/api/modem/network-mode")', 'agentClient.getJSON("/api/modem/data")'),
    ('/api/modem/apn/mode', '/api/router/apn/mode'),
    ('agentClient.deleteJSON("/api/modem/apn/profile"', 'agentClient.postJSON("/api/router/apn/profiles/delete"'),
    ('/api/modem/apn/profile', '/api/router/apn/profiles'),
    ('/api/modem/apn/activate', '/api/router/apn/profiles/activate'),
    ('/api/modem/signal-detect/status', '/api/cell/signal-detect/progress'),
    ('agentClient.postJSON("/api/modem/signal-detect")', 'agentClient.postJSON("/api/cell/signal-detect/start")'),
    ('/api/firewall/config', '/api/router/firewall'),
    ('/api/firewall/port-forward', '/api/router/firewall/port-forward'),
    ('agentClient.deleteJSON("/api/firewall/port-forward"', 'agentClient.postJSON("/api/router/firewall/port-forward/delete"'),
    ('/api/modem/stc/params', '/api/cell/stc/params'),
    ('/api/modem/stc/status', '/api/cell/stc/status'),
    ('agentClient.putJSON("/api/modem/stc"', 'agentClient.postJSON("/api/cell/stc/enable"'),
    ('/api/sim/pin/toggle', '/api/sim/pin/mode'),
    ('/api/sim/puk/verify', '/api/sim/pin/verify'),
    ('/api/sim/lock"', '/api/sim/lock-trials"'),
    ('agentClient.getJSON("/api/modem/scan")', 'agentClient.getJSON("/api/modem/scan/results")'),
    ('agentClient.getJSON("/api/modem/register")', 'agentClient.getJSON("/api/modem/register/result")')
]

# Sort by length descending to prevent replacing a substring before a longer match
replacements.sort(key=lambda x: len(x[0]), reverse=True)

changed_files_count = 0

if not os.path.exists(directory):
    print(f"Directory not found: {directory}")
else:
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.kt'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                original_content = content
                for old, new in replacements:
                    content = content.replace(old, new)
                    
                if content != original_content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Updated {filepath}")
                    changed_files_count += 1

    print(f"Replacement complete. {changed_files_count} files updated.")
