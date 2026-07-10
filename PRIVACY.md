# Privacy Policy — Meet Roll Attendance

**Last updated:** July 2026

Meet Roll Attendance is a local-only tool. It does not have a server, does
not make network requests, and does not send, sell, or share any data with
Mozilla, the developer, or any third party.

## What the extension reads
While a Google Meet tab (`meet.google.com`) is open, the extension's content
script reads the text visible in that tab's chat panel — sender display
names, timestamps, and message text — in order to detect roll numbers and
build the attendance table.

## What it stores, and where
Everything the extension collects (attendance entries, the optional full
chat transcript, and your section-range settings) is written to
`chrome.storage.local` / `browser.storage.local`, which is a storage area
private to the extension on the user's own device. This data:
- never leaves the browser,
- is never transmitted to any server, API, or analytics service,
- is not accessible to the extension developer,
- is only visible to the person using the browser it's installed in.

## Data retention and deletion
Data persists in local browser storage until the user removes it, using the
in-popup **Clear** (attendance) and **Clear log** (chat transcript) buttons,
or by uninstalling the extension, which deletes all of its local storage.

## Third-party code
The extension bundles two open-source libraries (jsPDF and jsPDF-AutoTable)
to generate PDF exports entirely on-device. These libraries do not make
network requests and do not transmit data anywhere.

## Permissions used
- `storage` — to save attendance data locally on the device.
- `activeTab` — to let the popup communicate with the currently open Meet
  tab (e.g. for the "parse pasted log" fallback).
- Host access to `https://meet.google.com/*` — required for the content
  script to read the chat panel on Meet pages only. No other site is
  accessed.

