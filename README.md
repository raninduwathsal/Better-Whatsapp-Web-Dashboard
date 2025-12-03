# WA Dash V2

Simple local app to connect your WhatsApp by scanning a QR code, display recent messages in a grid, select a message square and press the keyboard key `r` (or click "Send to selected") to send a preset reply.

Requirements
- Node.js 16+ (LTS recommended)

Install

```bash
cd c:/Users/Waths/Desktop/wa-dash-v2
npm install
```

Run

```bash
npm start
# open http://localhost:3000 in your browser
```

How it works
- On first run the server will print and emit a QR code. Scan with WhatsApp "Linked devices" → "Link a device".
- After authentication the UI hides the QR and shows messages.
- Click a message square to select it. Type a preset reply in the input and press `r` or click "Send to selected" to send.

Notes & next steps
- This is a minimal demo. Improve by adding:
  - message pagination and search
  - mapping message to exact chat contact/name
  - confirmations and delivery status
  - authentication & access control for the web UI

Troubleshooting
- If the QR does not appear, check server logs for the `qr` event or client initialization errors.
- For session persistence we use `whatsapp-web.js` `LocalAuth` folder `./.wwebjs_auth`.
