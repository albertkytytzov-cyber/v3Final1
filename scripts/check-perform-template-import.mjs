import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "..", "docs", "examples", "perform-template-v1-import-check.html");
const html = readFileSync(fixturePath, "utf8");

const expectedDays = [
  {
    label: "ПН 18.05",
    rowCount: 8,
    requiredRows: [
      ["Разминка", "8–12 мин"],
      ["ИТ-круг для митохондрий", "1 круг; 6×20–30 сек / 45–60 сек отдых"],
      ["СДР руки / предплечье", "3 сета"],
      ["Тяговая работа", "2×6–8 легко"],
    ],
  },
  {
    label: "ВТ 26.05",
    rowCount: 6,
    requiredRows: [
      ["Разминка", "10 мин"],
      ["Контроль АнП специальный", "3×5–6 мин / 3 мин"],
    ],
  },
  {
    label: "ПТ 29.05",
    rowCount: 7,
    requiredRows: [
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

const cards = extractCards(html);

for (const expectedDay of expectedDays) {
  const card = cards.find((item) => item.includes(`<span class="title">${expectedDay.label}</span>`));

  if (!card) {
    fail(`day ${expectedDay.label} is missing`);
    continue;
  }

  const tables = [...card.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/giu)].map((match) => match[1]);

  if (tables.length === 0) {
    fail(`day ${expectedDay.label} has no tables`);
    continue;
  }

  const rows = [];

  for (const table of tables) {
    const headers = extractHeaders(table);

    if (headers.join("|") !== "Блок|Объём") {
      fail(`day ${expectedDay.label} has unexpected headers: ${headers.join(" | ")}`);
    }

    if (headers.includes("Контроль")) {
      fail(`day ${expectedDay.label} returned the old Контроль column`);
    }

    rows.push(...extractRows(table));
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
  console.log("Import template check passed: 18.05, 26.05, 29.05 keep Блок | Объём and no Контроль column.");
}
