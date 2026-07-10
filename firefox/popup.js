// ============================================================
// Meet Roll Attendance — popup logic
// ============================================================

let currentRanges = DEFAULT_SECTION_RANGES.slice();
let currentStudents = {};
let currentLog = [];
let currentFilter = { search: "", section: "ALL" };
let logFilter = { search: "" };

const el = (id) => document.getElementById(id);

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ---------- Tabs ----------

document.querySelectorAll(".tab").forEach((tabBtn) => {
  tabBtn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
    tabBtn.classList.add("active");
    el("panel-" + tabBtn.dataset.tab).classList.remove("hidden");
  });
});

// ---------- Attendance table ----------

function buildRows() {
  return Object.values(currentStudents).map((s) => {
    const rolls = s.rolls.map((r) => ({ roll: r, section: findSectionForRoll(r, currentRanges) }));
    return {
      sender: s.name,
      rolls,
      conflict: rolls.length > 1,
      rawCount: s.rawCount || 0,
      lastSeen: s.lastSeen
    };
  });
}

function passesFilter(row) {
  const q = currentFilter.search.trim().toLowerCase();
  if (q) {
    const hay = (row.sender + " " + row.rolls.map((r) => r.roll).join(" ")).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (currentFilter.section !== "ALL") {
    const hasSection = row.rolls.some((r) => r.section === currentFilter.section);
    if (!hasSection) return false;
  }
  return true;
}

function renderStats(rows) {
  const present = rows.length;
  const conflicts = rows.filter((r) => r.conflict).length;
  const totalMsgs = rows.reduce((sum, r) => sum + r.rawCount, 0);
  el("statPresent").textContent = present;
  el("statConflicts").textContent = conflicts;
  el("statMessages").textContent = totalMsgs;
}

function renderSectionFilterOptions() {
  const select = el("sectionFilter");
  const existing = new Set(Array.from(select.options).map((o) => o.value));
  currentRanges.forEach((r) => {
    if (!existing.has(r.section)) {
      const opt = document.createElement("option");
      opt.value = r.section;
      opt.textContent = "Section " + r.section;
      select.appendChild(opt);
    }
  });
}

function renderTable() {
  const allRows = buildRows().sort((a, b) => a.sender.localeCompare(b.sender));
  const rows = allRows.filter(passesFilter);
  renderStats(allRows);

  const tbody = el("attTableBody");
  tbody.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "empty-row";
    td.textContent = allRows.length ? "No matches for this filter." : "Waiting for chat messages with roll numbers…";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const row of rows) {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = row.sender;

    const tdRolls = document.createElement("td");
    row.rolls.forEach((r) => {
      const chip = document.createElement("span");
      chip.className = "roll-chip" + (row.conflict ? " conflict" : "");
      chip.textContent = r.roll;
      tdRolls.appendChild(chip);
    });

    const tdSection = document.createElement("td");
    tdSection.textContent = row.conflict
      ? row.rolls.map((r) => r.section).join(", ")
      : row.rolls[0]?.section || "—";

    const tdStatus = document.createElement("td");
    const badge = document.createElement("span");
    if (row.conflict) {
      badge.className = "badge badge-conflict";
      badge.textContent = "Conflict";
    } else {
      badge.className = "badge badge-ok";
      badge.textContent = "OK";
    }
    tdStatus.appendChild(badge);

    tr.append(tdName, tdRolls, tdSection, tdStatus);
    tbody.appendChild(tr);
  }
}

function refreshMetaLine() {
  chrome.storage.local.get({ meta: {} }, (data) => {
    const meta = data.meta || {};
    el("metaLine").textContent = meta.lastUpdated ? "Last update " + formatTime(meta.lastUpdated) : "No data yet";
  });
}

// ---------- Chat log ----------

function passesLogFilter(entry) {
  const q = logFilter.search.trim().toLowerCase();
  if (!q) return true;
  return (entry.sender + " " + entry.text).toLowerCase().includes(q);
}

function renderLog() {
  const entries = currentLog.filter(passesLogFilter);
  el("logCount").textContent = currentLog.length;

  const list = el("logList");
  list.innerHTML = "";

  if (!entries.length) {
    const div = document.createElement("div");
    div.className = "empty-row";
    div.textContent = currentLog.length ? "No matches for this search." : "No messages logged yet.";
    list.appendChild(div);
    return;
  }

  // newest first
  const ordered = entries.slice().reverse();
  const frag = document.createDocumentFragment();
  for (const entry of ordered) {
    const div = document.createElement("div");
    div.className = "log-entry";

    const head = document.createElement("div");
    head.className = "log-entry-head";

    const senderSpan = document.createElement("span");
    senderSpan.className = "log-entry-sender";
    senderSpan.textContent = entry.sender;

    const timeSpan = document.createElement("span");
    timeSpan.className = "log-entry-time";
    timeSpan.textContent = entry.time || "";

    head.append(senderSpan, timeSpan);

    const textDiv = document.createElement("div");
    textDiv.className = "log-entry-text";
    textDiv.textContent = entry.text;

    div.append(head, textDiv);
    frag.appendChild(div);
  }
  list.appendChild(frag);
}

el("logSearchBox").addEventListener("input", (e) => {
  logFilter.search = e.target.value;
  renderLog();
});

// ---------- Load / state ----------

function loadAll() {
  chrome.storage.local.get(
    { students: {}, sectionRanges: DEFAULT_SECTION_RANGES, capturing: true, chatLog: [], loggingEnabled: true },
    (data) => {
      currentStudents = data.students || {};
      currentRanges = data.sectionRanges && data.sectionRanges.length ? data.sectionRanges : DEFAULT_SECTION_RANGES;
      currentLog = data.chatLog || [];
      renderSectionFilterOptions();
      renderTable();
      renderLog();
      setSwitch(el("toggleCapture"), data.capturing);
      setSwitch(el("toggleLogging"), data.loggingEnabled);
      renderRangeEditor();
    }
  );
  refreshMetaLine();
}

function setSwitch(button, on) {
  button.setAttribute("aria-checked", on ? "true" : "false");
}

// ---------- Events ----------

el("searchBox").addEventListener("input", (e) => {
  currentFilter.search = e.target.value;
  renderTable();
});

el("sectionFilter").addEventListener("change", (e) => {
  currentFilter.section = e.target.value;
  renderTable();
});

el("toggleCapture").addEventListener("click", () => {
  chrome.storage.local.get({ capturing: true }, (data) => {
    const next = !data.capturing;
    chrome.storage.local.set({ capturing: next }, () => setSwitch(el("toggleCapture"), next));
  });
});

el("toggleLogging").addEventListener("click", () => {
  chrome.storage.local.get({ loggingEnabled: true }, (data) => {
    const next = !data.loggingEnabled;
    chrome.storage.local.set({ loggingEnabled: next }, () => setSwitch(el("toggleLogging"), next));
  });
});

el("clearBtn").addEventListener("click", () => {
  if (!confirm("Clear the attendance table for this session? Chat log is kept.")) return;
  chrome.storage.local.set({ students: {}, meta: {} }, loadAll);
});

el("clearLogBtn").addEventListener("click", () => {
  if (!confirm("Clear the full chat log? This cannot be undone.")) return;
  chrome.storage.local.set({ chatLog: [] }, loadAll);
});

el("parsePasteBtn").addEventListener("click", () => {
  const text = el("pasteArea").value;
  if (!text.trim()) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, { type: "PARSE_PASTED_TEXT", text }, (resp) => {
      if (chrome.runtime.lastError) {
        el("pasteResult").textContent = "Couldn't reach the Meet tab. Open a Google Meet tab first.";
        return;
      }
      el("pasteResult").textContent = resp && resp.ok ? `Parsed ${resp.count} message(s).` : "Nothing parsed.";
      setTimeout(loadAll, 300);
    });
  });
});

// ---------- Range editor ----------

function renderRangeEditor() {
  const container = el("rangeEditor");
  container.innerHTML = "";
  currentRanges.forEach((r, idx) => {
    const row = document.createElement("div");
    row.className = "range-row";

    const nameInput = document.createElement("input");
    nameInput.value = r.section;
    nameInput.maxLength = 3;

    const minInput = document.createElement("input");
    minInput.type = "number";
    minInput.value = r.min;

    const maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.value = r.max;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "×";
    removeBtn.className = "remove-btn";
    removeBtn.addEventListener("click", () => {
      currentRanges.splice(idx, 1);
      renderRangeEditor();
    });

    [nameInput, minInput, maxInput].forEach((inp) => {
      inp.addEventListener("input", () => {
        currentRanges[idx] = {
          section: nameInput.value.trim() || "?",
          min: parseInt(minInput.value, 10) || 0,
          max: parseInt(maxInput.value, 10) || 0
        };
      });
    });

    row.append(nameInput, minInput, maxInput, removeBtn);
    container.appendChild(row);
  });
}

el("addRangeBtn").addEventListener("click", () => {
  currentRanges.push({ section: "?", min: 0, max: 0 });
  renderRangeEditor();
});

el("saveRangesBtn").addEventListener("click", () => {
  chrome.storage.local.set({ sectionRanges: currentRanges }, () => {
    el("rangeSaveResult").textContent = "Saved.";
    const select = el("sectionFilter");
    select.innerHTML = '<option value="ALL">All sections</option>';
    renderSectionFilterOptions();
    renderTable();
    setTimeout(() => (el("rangeSaveResult").textContent = ""), 1500);
  });
});

// ---------- Export: attendance ----------

el("exportCsvBtn").addEventListener("click", () => {
  const rows = buildRows().sort((a, b) => a.sender.localeCompare(b.sender));
  const lines = ["Sender,Roll(s),Section(s),Status"];
  rows.forEach((row) => {
    const rolls = row.rolls.map((r) => r.roll).join(" | ");
    const sections = row.rolls.map((r) => r.section).join(" | ");
    const status = row.conflict ? "Conflict" : "OK";
    lines.push(`"${row.sender.replace(/"/g, '""')}","${rolls}","${sections}","${status}"`);
  });
  triggerDownload(lines.join("\n"), "text/csv", "attendance.csv");
});

el("exportPdfBtn").addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const rows = buildRows().sort((a, b) => a.sender.localeCompare(b.sender));

  doc.setFontSize(16);
  doc.text("Meet Attendance Report", 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22);

  const body = rows.map((row) => [
    row.sender,
    row.rolls.map((r) => r.roll).join(", "),
    row.conflict ? row.rolls.map((r) => r.section).join(", ") : row.rolls[0]?.section || "—",
    row.conflict ? "Conflict" : "OK"
  ]);

  doc.autoTable({
    head: [["Sender", "Roll(s)", "Section", "Status"]],
    body,
    startY: 28,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [24, 24, 27] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3 && data.cell.raw === "Conflict") {
        data.cell.styles.textColor = [200, 40, 40];
        data.cell.styles.fontStyle = "bold";
      }
    }
  });

  const bySection = {};
  rows.forEach((row) => {
    row.rolls.forEach((r) => {
      bySection[r.section] = (bySection[r.section] || 0) + (row.conflict ? 0 : 1);
    });
  });
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text("Section summary:", 14, finalY);
  const summaryBody = Object.keys(bySection)
    .sort()
    .map((s) => [s, String(bySection[s])]);
  doc.autoTable({
    head: [["Section", "Present"]],
    body: summaryBody,
    startY: finalY + 4,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [24, 24, 27] }
  });

  doc.save("attendance.pdf");
});

// ---------- Export: chat log ----------

el("exportLogTxtBtn").addEventListener("click", () => {
  const lines = currentLog.map((e) => `[${e.time || ""}] ${e.sender}: ${e.text}`);
  triggerDownload(lines.join("\n"), "text/plain", "chat-log.txt");
});

el("exportLogCsvBtn").addEventListener("click", () => {
  const lines = ["Time,Sender,Message"];
  currentLog.forEach((e) => {
    lines.push(`"${(e.time || "").replace(/"/g, '""')}","${e.sender.replace(/"/g, '""')}","${e.text.replace(/"/g, '""')}"`);
  });
  triggerDownload(lines.join("\n"), "text/csv", "chat-log.csv");
});

function triggerDownload(content, mime, filename) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  if (chrome.downloads) {
    chrome.downloads.download({ url, filename });
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }
}

// ---------- Live refresh while popup is open ----------

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.students || changes.meta) {
    chrome.storage.local.get({ students: {} }, (data) => {
      currentStudents = data.students || {};
      renderTable();
    });
    refreshMetaLine();
  }
  if (changes.chatLog) {
    chrome.storage.local.get({ chatLog: [] }, (data) => {
      currentLog = data.chatLog || [];
      renderLog();
    });
  }
});

loadAll();
