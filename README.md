# Meet Roll Attendance

A browser extension that watches the Google Meet chat panel, pulls out roll
numbers students type in (e.g. `1125`), matches each one to a section using
your ranges, de-duplicates repeats, flags students who sent **more than one
different** roll number, and exports the result as a PDF (or CSV).

```
meet-roll-attendance/
├── edge/                       ← load this in Edge (or Chrome)
│   ├── manifest.json
│   ├── background.js           service worker, seeds defaults on install
│   ├── content.js               scrapes + parses the Meet chat panel
│   ├── config.js                default section ↔ roll-number ranges
│   ├── popup.html               popup UI markup
│   ├── popup.css                dark theme styling
│   ├── popup.js                 table rendering, filters, export, ranges
│   ├── icons/                   16/48/128 px icons
│   └── libs/
│       ├── jspdf.umd.min.js             (bundled, no CDN/remote code)
│       └── jspdf.plugin.autotable.min.js
└── firefox/                    ← load this in Firefox
    └── (same files, manifest.json uses Firefox's background.scripts form)
```

## How it works

1. **content.js** runs on `meet.google.com`. Google's internal class names
   change often, so instead of hard-coding brittle CSS selectors it reads the
   chat panel's rendered text, which reliably prints as:
   ```
   <Sender Name>
   <h:mm AM/PM>
   <message text>
   ```
   repeated per message. It diffs against the previous scan so it only
   processes new lines, and pulls any number in your configured roll range
   (default 1001–1251) out of each message.
2. Results are saved to `chrome.storage.local` as
   `{ studentName: { rolls: [...], rawCount, lastSeen } }`.
3. **popup.js** reads that storage, groups by section using your ranges, and
   renders the table live (it listens for storage changes, so you can leave
   the popup open during class).
4. Export button builds a PDF client-side with a bundled copy of jsPDF +
   AutoTable — nothing is uploaded anywhere.

### Duplicate / conflict rules
- Same student sends `1125` five times → counted **once**.
- Same student sends `1125` then later `1042` → shown as a **Conflict**, with
  both rolls and both sections listed, so you can review it manually.

### Full chat log
Every message in the chat — not just ones with a roll number — is saved to a
**Chat log** tab in the popup, so you can go back and check what was actually
said if a roll number gets disputed later. It has its own search box and
exports to `.txt` or `.csv`, independent of the attendance table. Turn it off
under **Settings → Log full chat transcript** if you'd rather not retain the
raw text. `Clear` on the Attendance tab only resets the attendance table;
use `Clear log` on the Chat log tab to wipe the transcript.

### If live capture doesn't pick anything up
Google occasionally changes Meet's markup in ways the text-pattern parser
doesn't expect. Open the extension popup → **"Chat didn't auto-capture? Paste
it manually"** → click inside the Meet chat panel, `Ctrl/Cmd+A` then
`Ctrl/Cmd+C` to copy everything, paste it in the box, click **Parse Pasted
Log**. It runs through the exact same parser.

## Install in Edge (do this first)

1. Unzip the package; you'll have an `edge` folder and a `firefox` folder.
2. Go to `edge://extensions`.
3. Turn on **Developer mode** (bottom-left toggle).
4. Click **Load unpacked** → select the `edge` folder.
5. Pin the extension (puzzle-piece icon → pin) so it's visible on the toolbar.
6. Join a Google Meet call, open the chat panel, and have students send their
   roll number. Click the extension icon any time to see live results.

## Install in Firefox

Two options:

**A. Temporary (fastest, good for testing)**
1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**
3. Select `firefox/manifest.json`.
4. Note: temporary add-ons are removed when Firefox restarts — reload it next
   session.

**B. Permanent (needs signing)**
Firefox only runs permanently-installed extensions that are signed by
Mozilla. For personal/class use, the simplest path is:
1. Zip the contents of the `firefox` folder (not the folder itself — the
   `manifest.json` should be at the zip root).
2. Submit it for signing at https://addons.mozilla.org/developers/ (choose
   **"On your own"** distribution — it stays unlisted, only people with the
   link/file can install it).
3. Install the signed `.xpi` Mozilla emails back to you.

## Editing section ranges

Defaults are already set to your ranges:

| Section | Roll range |
|---|---|
| A | 1001–1041 |
| B | 1042–1083 |
| C | 1084–1124 |
| D | 1125–1169 |
| E | 1170–1210 |
| F | 1211–1251 |

Open the popup → **"Edit section roll ranges"** to change these any time
(add/remove sections, adjust min/max) without editing code. Saved ranges
persist across sessions.

## Submitting to the Firefox Add-ons marketplace (AMO)

Mozilla now requires every new extension to declare its data-collection
practices directly in `manifest.json` (required since Nov 3, 2025). This is
already set up in `firefox/manifest.json`:

```json
"browser_specific_settings": {
  "gecko": {
    "id": "meet-roll-attendance@example.com",
    "strict_min_version": "109.0",
    "data_collection_permissions": {
      "required": ["none"]
    }
  }
}
```

`"required": ["none"]` is accurate here — nothing this extension touches is
ever transmitted outside the browser (see `PRIVACY.md`, included in this
package, which you can also paste into AMO's "Privacy Policy" field on
submission).

Before you submit:
1. **Change the `id`.** `meet-roll-attendance@example.com` is a placeholder —
   AMO requires it to be globally unique. Swap it for something like
   `yourname-meet-attendance@yourdomain.com`, or any string matching
   `name@domain` (doesn't need to be a real, working email).
2. **Zip only the contents** of the `firefox` folder — `manifest.json` must
   sit at the root of the zip, not inside a subfolder.
3. **Fill in a contact email** in `PRIVACY.md` if you paste it into the
   listing's privacy policy field.
4. Reviewers sometimes ask about bundled minified code. `libs/jspdf.umd.min.js`
   and `libs/jspdf.plugin.autotable.min.js` are the standard open-source
   jsPDF / jsPDF-AutoTable builds — if asked, you can point to
   https://github.com/parallax/jsPDF as the source.
5. Submit at https://addons.mozilla.org/developers/ — choose **"On your
   own"** distribution if you want it unlisted (only people with the link
   can install it), or list it publicly if you want it discoverable.

## Privacy
Everything runs locally in the browser. No network requests are made by the
extension itself — chat text never leaves the machine. Data is cleared with
the **Clear Session** button, or automatically stays in local storage between
classes if you don't clear it (handy for reviewing later, but remember to
clear before a new class if you want a fresh count).

## Known limitations
- Only messages containing a number inside your configured range are stored —
  general chat chatter is ignored.
- If two different students happen to type the exact same text as their
  browser display name (rare), they'll be merged under that name. Ask
  students to keep distinct display names.
- Live scraping depends on Meet's chat panel being open at least once during
  the call so the extension can locate it; the paste fallback covers you if
  it's missed.
