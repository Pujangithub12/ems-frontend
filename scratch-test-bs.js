const NepaliDate = require("nepali-date-converter");

function adDateForBsDay(year, month, day) {
  const d = new NepaliDate(year, month, day).toJsDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function bsStringToIso(raw) {
  if (raw == null) return null;
  const match = String(raw).trim().match(/^(\d{4})[\-/.](\d{1,2})[\-/.](\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (month < 0 || month > 11 || day < 1 || day > 32) return null;
  try {
    const iso = adDateForBsDay(year, month, day);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
  } catch {
    return null;
  }
}

for (const raw of ["2083/04/26", "2083/04/27", "2083/04/29", "2083/05/12"]) {
  console.log(raw, "->", bsStringToIso(raw));
}
