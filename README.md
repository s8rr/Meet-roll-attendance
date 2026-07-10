# Meet Roll Attendance

A browser extension that turns the "type your roll number in Google Meet chat" ritual into an actual attendance sheet — automatically, locally, and exportable to PDF.

No servers, no sign-in, no data leaving the browser. It reads the Meet chat panel, pulls out roll numbers, matches them to a section, and gives you a clean table you can export.

## Why

Online classes often take attendance by asking students to drop their roll number in the Meet chat. Someone still has to scroll through the chat afterward, cross off duplicates, and figure out who typed the wrong number. This extension does that part for you, live, while class is happening.

## Features

- **Live capture** — watches the Meet chat panel and extracts roll numbers as students send them, no manual scraping needed.
- **Dedupes automatically** — a student spamming the same roll number five times is counted once.
- **Flags conflicts** — a student sending two *different* roll numbers is flagged so you can manually check it, instead of silently picking one.
- **Section mapping** — maps every roll number to a section (A–F by default) using ranges you can edit right in the popup.
- **Full chat log** — optionally keeps a complete transcript of the chat (not just roll-number messages) so you can go back and check context later. Exportable to `.txt`/`.csv`, can be turned off in Settings.
- **PDF / CSV export** — one click generates a PDF with a per-student table and a section-by-section summary, entirely client-side.
- **Paste fallback** — if Google changes Meet's markup and live capture misses something, paste the copied chat log into the popup and it runs through the same parser.
- **Everything local** — all data lives in the browser's local extension storage. Nothing is transmitted anywhere. See [`PRIVACY.md`](./PRIVACY.md).

## Install

### Edge (or any Chromium browser)
1. Download/clone this repo.
2. Go to `edge://extensions` (or `chrome://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** → select the `edge/` folder.
5. Pin the extension, join a Meet call, open chat — attendance starts populating as roll numbers come in.

### Firefox

**Temporary, for testing:**
1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** → select `firefox/manifest.json`.
3. Note: removed on browser restart, reload as needed.

**Permanent:** requires signing through [addons.mozilla.org](https://addons.mozilla.org/developers/). See the submission notes in [`edge/../README` install section below](#submitting-to-amo) or the full walkthrough in the repo's install docs.

## How it works

Google Meet's internal class names are obfuscated and change often, so instead of brittle CSS selectors, the content script reads the chat panel's **rendered text**, which reliably follows this pattern per message:

```
<Sender Name>
<h:mm AM/PM>
<message text>
```

It diffs against the previous scan (so it only processes new lines), extracts any number inside your configured roll range from each message, and stores results in local extension storage as:

```js
{
  students: {
    "Jane Doe": { rolls: ["1125"], rawCount: 3, lastSeen: 173... },
    "John Roe": { rolls: ["1042", "1084"], rawCount: 2, lastSeen: 173... } // conflict
  }
}
```

The popup reads that storage, maps each roll to a section, and renders it live — no polling needed, it listens for storage changes.

## Section ranges

Defaults, editable anytime from the popup (**Section roll ranges**):

| Section | Roll range |
|---|---|
| A | 1001–1041 |
| B | 1042–1083 |
| C | 1084–1124 |
| D | 1125–1169 |
| E | 1170–1210 |
| F | 1211–1251 |

## Repo structure

```
meet-roll-attendance/
├── edge/                              Chromium build (Edge, Chrome, Brave, etc.)
│   ├── manifest.json
│   ├── background.js                  service worker — seeds default storage
│   ├── content.js                     scrapes + parses the Meet chat panel
│   ├── config.js                      default section ↔ roll-number ranges
│   ├── popup.html / popup.css / popup.js
│   ├── icons/
│   └── libs/
│       ├── jspdf.umd.min.js                     bundled, no CDN/remote code
│       └── jspdf.plugin.autotable.min.js
├── firefox/                           same code, Firefox-flavored manifest
├── PRIVACY.md                         privacy policy (for AMO listing / users)
└── README.md
```

## Privacy

Everything runs on-device. No network requests are made by the extension. Full details in [`PRIVACY.md`](./PRIVACY.md).

## Known limitations

- Live scraping depends on Meet's chat DOM staying in a predictable text layout — if Google changes it, use the paste fallback until the parser is updated.
- Two different students using the exact same Meet display name will be merged into one row.
- The chat panel needs to have been opened at least once during the call so the extension can locate it.

## Contributing

Issues and PRs welcome — especially around keeping the chat-parsing heuristic resilient to Meet UI changes.

## License

MIT

---

Developed by [Sabbir](https://sabbir.cc)
