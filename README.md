# Local Authenticator Chrome Extension

## Overview
Local Authenticator is a non-profit, lightweight, open-source Chrome extension that generates one-time passcodes in your browser using TOTP (time-based) and HOTP (counter-based) methods.

This project is built with plain HTML, CSS, and JavaScript, and is designed to run fully on your local machine.

## Project Principles
- **Non-profit**: This project is not built for commercial exploitation.
- **Lightweight**: No frameworks or remote dependencies are required.
- **Open source**: The code is transparent and auditable.
- **Security-focused**: OTP generation is performed locally using browser crypto APIs.
- **No scamming intent**: The project is intended for legitimate authentication use.
- **No data exfiltration**: The extension does not fetch or send account secrets to any server.
- **Fully local execution**: Data is stored only in `chrome.storage.local` on your browser profile.

## Features
- Add new authenticator keys
- Edit key details (including name)
- Delete saved keys
- Generate TOTP codes with Google Authenticator defaults (HMAC-SHA1, 6 digits, 30-second period)
- Generate HOTP codes with explicit counter increment behavior
- Persist key data in `chrome.storage.local`

## Technical Notes
- Manifest Version: Chrome Extension Manifest V3
- Storage: `chrome.storage.local`
- Crypto: Web Crypto API (`crypto.subtle`) for HMAC
- OTP Standards:
  - HOTP: RFC 4226
  - TOTP: RFC 6238

## Install (Developer Mode)
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder (`authenticator-extension`).
5. Click the extension icon to open the popup.

## Usage
1. Open the extension popup.
2. Select **Add Key**.
3. Enter a name and Base32 secret.
4. Choose key type:
   - **TOTP** for time-based codes
   - **HOTP** for counter-based codes
5. Save the key.
6. Use **Edit** to update details or **Delete** to remove a key.

For HOTP keys, each **Generate** action increments the stored counter by one.

## Security and Privacy Statement
This extension is designed for local-only OTP generation. It does not include telemetry, remote APIs, analytics beacons, or server synchronization.

You should still protect your local device and browser profile, because anyone with access to your local profile data could potentially access stored secrets.

## License
This repository is open source. Add your preferred license file before distribution.