import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "..", "docs", "examples", "perform-template-v1-import-check.html");
const samplePath = join(__dirname, "..", "docs", "examples", "perform-template-v1-one-day.html");
const html = readFileSync(fixturePath, "utf8");
const sampleHtml = readFileSync(samplePath, "utf8");

const expectedDays = [
  {
    label: "ПН 18.05",
    rowCount: 8,
    sessionRowCounts: [4, 4],
    sessionTitles: [
      "УТРО — техника борьбы + селуяновская вставка ИТ",
      "ВЕЧЕР — физическая работа по слабому звену",
    ],
    requiredRows: [
      ["Разминка", "8–12 мин"],
      ["ИТ-круг для митохондрий", "1 круг; 6×20–30 сек / 45–60 сек отдых"],
      ["Техника борьбы", "30–45 мин"],
      ["Заминка / стретчинг", "5–8 мин"],
      ["Разминка + ИТ", "1 круг; 6×20 сек"],
      ["СДР руки / предплечье", "3 сета"],
      ["Тяговая работа", "2×6–8 легко"],
      ["Стретчинг", "10 мин"],
    ],
  },
  {
    label: "ВТ 26.05",
    rowCount: 6,
    sessionRowCounts: [4, 2],
    sessionTitles: [
      "УТРО — техника борьбы + селуяновская вставка ИТ",
      "ВЕЧЕР — физическая работа по слабому звену",
    ],
    requiredRows: [
      ["Разминка", "8–12 мин"],
      ["ИТ-круг для митохондрий", "1 круг; 6×20–30 сек / 45–60 сек отдых"],
      ["Техника борьбы", "30–45 мин"],
      ["Заминка / стретчинг", "5–8 мин"],
      ["Разминка", "10 мин"],
      ["Контроль АнП специальный", "3×5–6 мин / 3 мин"],
    ],
  },
  {
    label: "ПТ 29.05",
    rowCount: 7,
    sessionRowCounts: [4, 3],
    sessionTitles: [
      "УТРО — техника борьбы + селуяновская вставка ИТ",
      "ВЕЧЕР — физическая работа по слабому звену",
    ],
    requiredRows: [
      ["Разминка", "8–12 мин"],
      ["ИТ-круг для митохондрий", "1 круг; 6×20–30 сек / 45–60 сек отдых"],
      ["Техника борьбы", "30–45 мин"],
      ["Заминка / стретчинг", "5–8 мин"],
      ["Борцовская работа", "15–20 мин"],
      ["Контрольные отрезки", "2×3 мин / пауза 30 сек"],
      ["Recovery HR", "пик / 1 мин / 2 мин / 3 мин"],
    ],
  },
];

function fail(message) {
  console.error(`Import template check failed: ${message}`);
  process.exitCode = 1;
}

function normalizeText(value) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCards(source) {
  return source
    .split(/<div class="card"[^>]*>/u)
    .slice(1)
    .map((part) => `<div class="card">${part.split(/(?=<div class="card"[^>]*>)/u)[0]}`);
}

function extractCells(rowHtml) {
  return [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/giu)]
    .map((match) => normalizeText(match[1]));
}

function extractHeaders(tableHtml) {
  return [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/giu)]
    .map((match) => normalizeText(match[1]));
}

function extractRows(tableHtml) {
  return [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/giu)]
    .map((match) => extractCells(match[1]))
    .filter((cells) => cells.length > 0);
}

function extractSessionTitles(cardHtml) {
  return [...cardHtml.matchAll(/<div class="stime"[^>]*>([\s\S]*?)<\/div>/giu)]
    .map((match) => normalizeText(match[1]));
}

const cards = extractCards(html);
const sampleHeaders = [...sampleHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/giu)].map((match) =>
  normalizeText(match[1]),
);

if (sampleHeaders.includes("Контроль")) {
  fail("one-day PERFORM_TEMPLATE_V1 sample still contains the old Контроль column");
}

for (const expectedDay of expectedDays) {
  const card = cards.find((item) => item.includes(`<span class="title">${expectedDay.label}</span>`));

  if (!card) {
    fail(`day ${expectedDay.label} is missing`);
    continue;
  }

  const tables = [...card.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/giu)].map((match) => match[1]);
  const sessionTitles = extractSessionTitles(card);

  if (tables.length === 0) {
    fail(`day ${expectedDay.label} has no tables`);
    continue;
  }

  if (tables.length !== expectedDay.sessionRowCounts.length) {
    fail(`day ${expectedDay.label} has ${tables.length} sessions instead of ${expectedDay.sessionRowCounts.length}`);
  }

  expectedDay.sessionTitles.forEach((title, index) => {
    if (sessionTitles[index] !== title) {
      fail(`day ${expectedDay.label} session ${index + 1} title changed: "${sessionTitles[index] ?? ""}"`);
    }
  });

  const rows = [];

  for (const [tableIndex, table] of tables.entries()) {
    const headers = extractHeaders(table);

    if (headers.join("|") !== "Блок|Объём") {
      fail(`day ${expectedDay.label} has unexpected headers: ${headers.join(" | ")}`);
    }

    if (headers.includes("Контроль")) {
      fail(`day ${expectedDay.label} returned the old Контроль column`);
    }

    const tableRows = extractRows(table);
    const expectedTableRows = expectedDay.sessionRowCounts[tableIndex];

    if (expectedTableRows !== undefined && tableRows.length !== expectedTableRows) {
      fail(`day ${expectedDay.label} session ${tableIndex + 1} has ${tableRows.length} rows instead of ${expectedTableRows}`);
    }

    tableRows.forEach((cells, rowIndex) => {
      if (cells.length !== 2) {
        fail(`day ${expectedDay.label} session ${tableIndex + 1} row ${rowIndex + 1} has ${cells.length} cells instead of 2`);
      }

      if (!cells[0] || !cells[1]) {
        fail(`day ${expectedDay.label} session ${tableIndex + 1} row ${rowIndex + 1} has an empty block or volume`);
      }
    });

    rows.push(...tableRows);
  }

  if (rows.length !== expectedDay.rowCount) {
    fail(`day ${expectedDay.label} has ${rows.length} rows instead of ${expectedDay.rowCount}`);
  }

  for (const [block, volume] of expectedDay.requiredRows) {
    const hasRow = rows.some(([rowBlock, rowVolume]) => rowBlock === block && rowVolume === volume);

    if (!hasRow) {
      fail(`day ${expectedDay.label} lost row "${block}" / "${volume}"`);
    }
  }
}

if (!process.exitCode) {
  console.log("Import template check passed: 18.05, 26.05, 29.05 keep session structure, Блок | Объём and no Контроль column.");
}
