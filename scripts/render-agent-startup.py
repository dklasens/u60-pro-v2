#!/usr/bin/env python3
"""Render startup configuration to stdout; credentials enter through stdin JSON.

The caller writes to a private temporary file, transfers it as data, validates
it with sh -n, and atomically replaces the live startup file. Never interpolate
this output into a remote shell command.
"""
import json
import shlex
import sys


def render(password: str, pin: str = "") -> str:
    if not isinstance(password, str) or not password or "\0" in password:
        raise ValueError("a nonempty password without NUL is required")
    if not isinstance(pin, str) or (pin and (len(pin) != 6 or not pin.isascii() or not pin.isdigit())):
        raise ValueError("PIN must be empty or exactly six ASCII digits")
    lines = ["#!/bin/sh", f"export ZTE_AGENT_PASSWORD={shlex.quote(password)}"]
    # Explicitly clear inherited credentials when removing a PIN.
    lines.append(f"export ZTE_AGENT_PIN={shlex.quote(pin)}" if pin else "unset ZTE_AGENT_PIN")
    # Ignore HUP before forking: legacy ADB can close before nohup executes.
    lines.append("trap '' HUP")
    lines.append("nohup sh -c '/data/zte-agent 2>&1 | logger -t zte-agent' >/dev/null 2>&1 </dev/null &")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    values = json.load(sys.stdin)
    sys.stdout.write(render(values["password"], values.get("pin", "")))
