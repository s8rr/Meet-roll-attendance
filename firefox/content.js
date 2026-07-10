// ============================================================
// Meet Roll Attendance — content script
//
// Google Meet's internal class names are obfuscated and change
// often, so instead of relying on brittle CSS selectors we read
// the RENDERED TEXT of the chat panel (innerText), which follows
// a stable visual pattern:
//
//   <Sender Name>
//   <h:mm AM/PM>
//   <message text...>
//
// repeated for every message. We diff against the previous scan
// so we don't reprocess old messages, extract roll numbers from
// each message body with a regex, and store per-student results
// in chrome.storage.local so the popup can read/export them.
//
// A "Paste chat log" fallback exists in the popup for when Meet's
// layout changes and live scraping stops matching.
// ============================================================

(function () {
  const TIME_REGEX = /^\d{1,2}:\d{2}\s?(AM|PM)$/i;
  const { min: ROLL_MIN, max: ROLL_MAX } = getGlobalRollBounds(DEFAULT_SECTION_RANGES);
  const ROLL_REGEX = new RegExp(`\\b(\\d{3,4})\\b`, "g");

  let lastProcessedLineCount = 0;
  let chatContainer = null;
  let observer = null;
  let pollTimer = null;

  function log(...args) {
    console.log("[MeetRollAttendance]", ...args);
  }

  // Try several strategies to find the chat panel container.
  function findChatContainer() {
    // Strategy 1: the element that contains the "Send a message" textbox
    const input = document.querySelector(
      'textarea[aria-label*="Send a message" i], input[aria-label*="Send a message" i], div[aria-label*="Send a message" i][contenteditable="true"]'
    );
    if (input) {
      // Walk up to a reasonably sized ancestor that also contains prior messages
      let el = input;
      for (let i = 0; i < 8 && el.parentElement; i++) {
        el = el.parentElement;
        if (el.innerText && el.innerText.length > (input.innerText || "").length + 20) {
          return el;
        }
      }
      return input.parentElement;
    }

    // Strategy 2: aria-live regions (chat messages are usually announced)
    const live = document.querySelector('[aria-live="polite"][role="log"], [role="log"]');
    if (live) return live;

    // Strategy 3: any element whose aria-label mentions "Chat with everyone" / "chat messages"
    const labeled = document.querySelector(
      '[aria-label*="Chat with everyone" i], [aria-label*="chat messages" i]'
    );
    if (labeled) return labeled;

    return null;
  }

  function getCapturingFlag(cb) {
    chrome.storage.local.get({ capturing: true }, (data) => cb(data.capturing));
  }

  function extractRollsFromText(text) {
    const found = new Set();
    let m;
    ROLL_REGEX.lastIndex = 0;
    while ((m = ROLL_REGEX.exec(text)) !== null) {
      const n = parseInt(m[1], 10);
      if (n >= ROLL_MIN && n <= ROLL_MAX) found.add(String(n));
    }
    return Array.from(found);
  }

  // Parse raw chat text (innerText) into {sender, time, text} messages.
  function parseChatText(rawText) {
    const lines = rawText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const messages = [];
    let i = 0;
    while (i < lines.length) {
      if (i + 1 < lines.length && TIME_REGEX.test(lines[i + 1])) {
        const sender = lines[i];
        const time = lines[i + 1];
        let j = i + 2;
        const textLines = [];
        while (j < lines.length) {
          if (j + 1 < lines.length && TIME_REGEX.test(lines[j + 1])) break;
          textLines.push(lines[j]);
          j++;
        }
        messages.push({ sender, time, text: textLines.join(" ") });
        i = j;
      } else {
        i++;
      }
    }
    return { messages, lineCount: lines.length };
  }

  const MAX_LOG_ENTRIES = 5000;

  function storeMessages(messages) {
    if (!messages.length) return;
    chrome.storage.local.get(
      { students: {}, meta: {}, chatLog: [], loggingEnabled: true },
      (data) => {
        const students = data.students || {};
        const meta = data.meta || {};
        let chatLog = data.chatLog || [];
        meta.lastUpdated = Date.now();
        meta.meetingUrl = location.href;

        for (const msg of messages) {
          // Full transcript log (every message, regardless of roll number).
          if (data.loggingEnabled) {
            chatLog.push({ sender: msg.sender, time: msg.time, text: msg.text, ts: Date.now() });
          }

          const rolls = extractRollsFromText(msg.text);
          if (!rolls.length) continue; // no roll number → doesn't affect attendance table
          const key = msg.sender;
          if (!students[key]) {
            students[key] = { name: msg.sender, rolls: [], firstSeen: Date.now(), lastSeen: Date.now(), rawCount: 0 };
          }
          students[key].lastSeen = Date.now();
          students[key].rawCount += 1;
          for (const roll of rolls) {
            if (!students[key].rolls.includes(roll)) {
              students[key].rolls.push(roll);
            }
          }
        }

        if (chatLog.length > MAX_LOG_ENTRIES) {
          chatLog = chatLog.slice(chatLog.length - MAX_LOG_ENTRIES);
        }

        chrome.storage.local.set({ students, meta, chatLog });
      }
    );
  }

  function scanChat() {
    if (!chatContainer) {
      chatContainer = findChatContainer();
      if (!chatContainer) return;
    }
    getCapturingFlag((capturing) => {
      if (!capturing) return;
      const rawText = chatContainer.innerText || "";
      const { messages, lineCount } = parseChatText(rawText);
      if (lineCount === lastProcessedLineCount) return;
      lastProcessedLineCount = lineCount;
      storeMessages(messages);
    });
  }

  function startObserving() {
    chatContainer = findChatContainer();
    if (chatContainer) {
      log("Chat container found, observing…");
      observer = new MutationObserver(() => scanChat());
      observer.observe(chatContainer, { childList: true, subtree: true, characterData: true });
      scanChat();
    }
    // Also poll periodically as a safety net (chat panel may not exist yet,
    // or may get replaced when re-opened).
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      const found = findChatContainer();
      if (found && found !== chatContainer) {
        chatContainer = found;
        if (observer) observer.disconnect();
        observer = new MutationObserver(() => scanChat());
        observer.observe(chatContainer, { childList: true, subtree: true, characterData: true });
        lastProcessedLineCount = 0;
      }
      scanChat();
    }, 3000);
  }

  // Listen for manual "parse pasted text" requests from the popup.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "PARSE_PASTED_TEXT") {
      const { messages } = parseChatText(msg.text);
      storeMessages(messages);
      sendResponse({ ok: true, count: messages.length });
    }
    return true;
  });

  startObserving();
})();
