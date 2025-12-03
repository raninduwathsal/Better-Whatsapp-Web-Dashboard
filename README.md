# Better Whatsapp Web (WA Dash)

Simple local app to connect your WhatsApp by scanning a QR code, display recent messages in a grid, select a chat card (or click "Send to selected") to send a preset reply.

very benificial if you want to manage a lot of chats quickly, there arent many solutions to do this and most ways require you to have a meta bussiness account and whatsapp bussiness api, this uses a workaround to get us workinig on personal whatsapp accounts (see Risks And Important Features)

To DO: Create a branch with support for official whatsapp bussiness API (PRs welcome)
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
tests (for developers)
```bash
npm run test-quick-replies # tests the quick reply functionality CRUD + DB export imports as json
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

## Better WhatsApp (wa-dash-v2)

Better WhatsApp is a local desktop web app that connects to your WhatsApp account via WhatsApp Web and provides a compact, productivity-focused dashboard for handling messages and sending preset replies.

This project is a developer-focused prototype — run it locally, connect by scanning a WhatsApp QR code, and keep the session on your machine.

### Why "Better WhatsApp"?
- Focused inbox: grid of chat cards so you can scan recent conversations quickly.
- Quick replies: create, edit, import/export, and send preset messages to single or multiple selected chats.
- Persistent server-side storage: quick replies are stored in a local SQLite file (`data.sqlite`) (implemented with `sql.js`) so presets survive restarts.
- Full-chat modal: open a chat to see a scrollable history (with inline images and PDF previews) and send messages from the modal.
- Pinning & unread prioritization: pin important chats and surface unread conversations.

### Special Features
- Quick Replies CRUD: create, edit, delete, import from JSON, export to JSON.
- Multi-select send: select multiple chat cards and send a quick reply to all of them at once.
- Compact cards: each chat card shows last messages (up to 3) with WhatsApp-like bubbles for quick scanning.
- Sticker & media preview: stickers are shown inline in compact cards (small thumbnail) and full media (images/PDFs) render inside the full-chat modal.
- Server-backed persistence: presets stored in `data.sqlite` using `sql.js` (WASM) for portability without native builds.
- Small test harness: `test/test_quick_replies.js` exercises the quick-reply API (create/update/delete/export/import) and exits with a pass/fail code so you can quickly verify changes.

### Risks & Important Notes
- This app uses the WhatsApp Web client (via `whatsapp-web.js`) and requires scanning your WhatsApp QR to link. The application acts like a browser session for your account.
- Security & privacy risks:
  - Anyone with access to your machine and the LocalAuth session files can access your WhatsApp session.
  - Media and messages may be downloaded and temporarily encoded as data URLs for preview; large files may increase disk and memory usage.
  - Keep `data.sqlite` and the `./.wwebjs_auth` session folder secure and backed up if needed.
- WhatsApp Terms of Service:
  - Using third-party tools to access WhatsApp Web may violate WhatsApp's Terms of Service in some circumstances. Use this project only for personal, legitimate use and at your own risk.

### Pros and Cons

- Pros:
  - Faster triage: grid + recency/unread sorting helps process messages quickly.
  - Reusable quick replies: saves typing and supports multiline replies.
  - Local-first: data and session stay on your machine (no central server required).
  - Lightweight persistence without native installs (`sql.js` avoids native builds).

- Cons / Limitations:
  - Not an official WhatsApp client — behavior depends on WhatsApp Web and `whatsapp-web.js` internals.
  - Media handling is basic: large files are encoded as data URLs; consider adding streaming or direct file links for heavy usage.
  - No user authentication for the web UI in this prototype — anyone who can reach the server can control the linked WhatsApp session.
  - Possible breakage: changes to WhatsApp Web can break the underlying library and require updates.

### Quick Start

Requirements
- Node.js (LTS recommended, >= 18 works well)

Install

```powershell
cd c:/Users/Waths/Desktop/wa-dash-v2
npm install
```

Run

```powershell
npm start
# open http://localhost:3000 in your browser
```

### Walkthrough
- On first run the server will emit a QR code to the UI. In WhatsApp: Menu → Linked devices → Link a device → scan the QR.
- After linking the UI shows a grid of recent chats. Click a card to select it (Ctrl/Cmd+click for multi-select).
- Use `+` to create a quick reply (multiline), or `⚙` → Export/Import to manage presets.
- Double-click a card to open the full-chat modal where you can view and send messages.

### Testing
- Run the included quick-replies end-to-end test after starting the server to verify the API:

```powershell
npm run test-quick-replies
```

This test creates a quick reply, updates it, exports the list, imports test items, verifies they exist, and cleans up — it exits with code `0` on success and `1` on failure.

### Troubleshooting
- If the QR does not appear, check server logs for `qr` or initialization errors.
- If `sql.js` fails to load the WASM, you may need to ensure `node_modules/sql.js/dist/sql-wasm.wasm` is present; I can add an explicit locateFile option if needed.
- If you previously hit native build issues with `better-sqlite3`, this project uses `sql.js` to avoid that on Windows.

### Security Recommendations
- Run this app only on trusted machines.
- Protect the `./.wwebjs_auth` folder and `data.sqlite` file (don’t share them).
- If exposing this server beyond localhost, add authentication (not included in the prototype).

### Contributing
- This project is a prototype — contributions welcome. Useful additions:
  - authentication for the web UI
  - paginated message loading and search
  - streaming media previews and thumbnails
  - per-chat pin persistence

### License & Disclaimer
- This is an independent project (MIT-style usage). It is not affiliated with WhatsApp/Facebook/Meta.
- Use responsibly and respect WhatsApp's Terms of Service.
