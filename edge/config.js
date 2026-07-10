// ============================================================
// SECTION / ROLL NUMBER RANGES
// Edit this list if your ranges change. Keep it in sync between
// config.js (used by content.js) — popup.js reads the same
// ranges from chrome.storage (seeded from here on first run).
// ============================================================
const DEFAULT_SECTION_RANGES = [
  { section: "A", min: 1001, max: 1041 },
  { section: "B", min: 1042, max: 1083 },
  { section: "C", min: 1084, max: 1124 },
  { section: "D", min: 1125, max: 1169 },
  { section: "E", min: 1170, max: 1210 },
  { section: "F", min: 1211, max: 1251 }
];

function getGlobalRollBounds(ranges) {
  const min = Math.min(...ranges.map(r => r.min));
  const max = Math.max(...ranges.map(r => r.max));
  return { min, max };
}

function findSectionForRoll(roll, ranges) {
  const n = parseInt(roll, 10);
  for (const r of ranges) {
    if (n >= r.min && n <= r.max) return r.section;
  }
  return "Unknown";
}

// Expose for both content-script (var scope) and popup (module-less script tag)
if (typeof window !== "undefined") {
  window.DEFAULT_SECTION_RANGES = DEFAULT_SECTION_RANGES;
  window.getGlobalRollBounds = getGlobalRollBounds;
  window.findSectionForRoll = findSectionForRoll;
}
