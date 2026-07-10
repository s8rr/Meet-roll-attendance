// Seed default storage on install so popup.js always has values to read.
const DEFAULT_SECTION_RANGES = [
  { section: "A", min: 1001, max: 1041 },
  { section: "B", min: 1042, max: 1083 },
  { section: "C", min: 1084, max: 1124 },
  { section: "D", min: 1125, max: 1169 },
  { section: "E", min: 1170, max: 1210 },
  { section: "F", min: 1211, max: 1251 }
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    { sectionRanges: null, students: null, capturing: null, chatLog: null, loggingEnabled: null },
    (data) => {
      const patch = {};
      if (!data.sectionRanges) patch.sectionRanges = DEFAULT_SECTION_RANGES;
      if (!data.students) patch.students = {};
      if (data.capturing === null || data.capturing === undefined) patch.capturing = true;
      if (!data.chatLog) patch.chatLog = [];
      if (data.loggingEnabled === null || data.loggingEnabled === undefined) patch.loggingEnabled = true;
      if (Object.keys(patch).length) chrome.storage.local.set(patch);
    }
  );
});
