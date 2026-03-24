# Local Authenticator Chrome Extension

## Overview
Local Authenticator is a non-profit, lightweight, open-source Chrome extension that generates one-time passcodes in your browser using TOTP (time-based) and HOTP (counter-based) methods.

This project is built with plain HTML, CSS, and JavaScript, and runs fully on your local machine.

## Project Principles
- **Non-profit**: This project is not built for commercial exploitation.
- **Lightweight**: No frameworks or remote dependencies are required.
- **Open source**: The code is transparent and auditable.
- **Security-focused**: OTP generation is performed locally using browser crypto APIs.
- **No scamming intent**: The project is intended for legitimate authentication use.
- **No data exfiltration**: The extension does not fetch or send account secrets to any server.
- **Fully local execution**: Data is stored only in `chrome.storage.local` on your browser profile.

## Features
- Add key flow with two choices: **Add new** and **Add with URI**
- URI import via `otpauth://` Key URI format
- Manual key management (add, edit, delete)
- TOTP generation with Google Authenticator defaults:
  - Algorithm: HMAC-SHA1
  - Digits: 6
  - Period: 30 seconds
- HOTP generation with explicit counter increment on **Generate**
- Click OTP code to copy
- Light/dark mode switch with persisted preference
- Local persistence through `chrome.storage.local`

## Technical Notes
- Manifest Version: Chrome Extension Manifest V3
- Runtime model: popup-only (`action.default_popup`)
- No background/service worker execution
- OTP values are calculated while popup is open
- Storage: `chrome.storage.local`
- Crypto: Web Crypto API (`crypto.subtle`) for HMAC
- OTP standards:
  - HOTP: RFC 4226
  - TOTP: RFC 6238

## Install (Developer Mode)
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder (`authenticator-extension`).
5. Click the extension icon to open the popup.

## Usage
### Add manually
1. Open the extension popup.
2. Click **Add Key**.
3. Select **Add new**.
4. Enter name and Base32 secret.
5. Choose type (**TOTP** or **HOTP**) and save.

### Add with URI
1. Open the extension popup.
2. Click **Add Key**.
3. Select **Add with URI**.
4. Paste an `otpauth://` URI and save.

### Manage keys
- Open the **⋯** menu on a key card to edit or delete.
- Click the displayed OTP code to copy it.
- For HOTP keys, click **Generate** to create the next code and increment counter.
- Use the header switch to toggle light/dark mode.

## URI Support Notes
- Supported URI types: `totp`, `hotp`
- Required parameter: `secret`
- For imported TOTP keys, extension constraints are enforced:
  - SHA1 only
  - 6 digits only
  - 30-second period only
- For imported HOTP keys:
  - Digits: 6 or 8
  - Non-negative `counter` is required

## Security and Privacy Statement
This extension is designed for local-only OTP generation. It does not include telemetry, remote APIs, analytics beacons, or server synchronization.

You should still protect your local device and browser profile, because anyone with access to your local profile data could potentially access stored secrets.

## License
This repository is open source. Add your preferred license file before distribution.
