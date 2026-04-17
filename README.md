# Open U60 Pro

Open U60 Pro is an open-source project designed to unlock the full potential of ZTE U60 Pro modems (and potentially other compatible devices). It augments the default restricted environment with a modern, high-performance agent and a beautifully designed web dashboard.

## Project Architecture

The codebase is cleanly organized into three distinct components:

1. **Installer (`/installer`)**: The initial setup tooling to gain ADB/root access and provision the device.
2. **Agent (`/agent`)**: The Rust-based backend API bridge running natively on the modem.
3. **Web App (`/web-app`)**: The modern frontend dashboard served from the modem.

---

## 1. The Installer & Setup Process

The installation process takes a locked-down, factory-state modem and provisions it for developer access and custom software. 

**How it works (`setup.sh` / WebUSB):**
- **Gaining Access**: Authenticates with the modem's default web interface to enable ADB (USB Debugging) access.
- **Provisioning**: Cross-compiles (or downloads) the Rust agent and securely pushes it to the device's persistent storage (`/data/zte-agent`).
- **Persistence**: Modifies the device's boot scripts (`/etc/rc.local`) to ensure the custom agent starts automatically as a background service on every boot.
- **SSH Setup**: Optionally installs Dropbear SSH on port `2222`. This allows for seamless, wireless future updates and debugging without needing a physical USB connection.

---

## 2. The Agent

Located in `/agent`, the `zte-agent` is a highly optimized native binary written in Rust. It is cross-compiled for the modem's specific architecture (`aarch64-unknown-linux-musl`).

**How it works:**
- The agent runs directly on the modem as a lightweight background service, listening on port `9090`.
- It acts as a high-speed, secure API bridge between the frontend and the modem's internal systems.
- It interfaces directly with the modem's internal `ubus` RPC system, AT command interfaces, and raw Linux system files (`sysfs`).
- It exposes structured, real-time JSON endpoints for everything from advanced cellular metrics (RSRP, RSRQ, SINR, Carrier Aggregation) to battery management, connected clients, and SMS operations.

---

## 3. The Web App Dashboard

Located in `/web-app`, the frontend is a React single-page application built with Vite. The interface has been completely revamped to feature a premium aesthetic, combining **Salesforce Lightning Design System (SLDS 2)** precision with **Apple MacOS 26** visual flair (glassmorphism, subtle shadows, and neutral grays).

**Functional Capabilities:**
- **Real-Time Dashboard**: A comprehensive overview of signal strength, battery lifecycle, live throughput (upload/download speeds), and data consumption.
- **Advanced Signal Diagnostics**: Deep-dive metrics into LTE and 5G NR connections, displaying live values for primary and secondary aggregated carriers (PCC/SCC), including PCI, Bandwidth, and Frequency bands.
- **Network & Router Management**: Monitor WAN/LAN statuses, view connected clients, and configure essential routing behaviors.
- **Band Locking**: Directly control the modem's behavior by locking it to specific frequency bands to optimize for speed or stability in your local area.
- **Modem Tools**: Manage APN profiles, send raw AT commands directly to the modem baseband, read and send SMS messages, and reboot the system safely.

The compiled web app is deployed directly to the modem's internal `uhttpd` web server root (`/data/www`), making it seamlessly accessible to any connected device at `http://192.168.0.1:8080`.

---

## Development & Deployment Scripts

For ongoing development, the project includes optimized scripts for rapid, wireless iteration:

- **`./deploy.sh`**: Rebuilds the Rust agent and deploys the updated binary directly to the modem over SSH, gracefully restarting the background service.
- **`./deploy-dashboard.sh`**: Compiles the React web application and securely transfers the optimized static assets to the modem's web root (`/data/www`) using SCP.
