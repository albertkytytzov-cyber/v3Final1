import type {
  CompetitionLevel,
  UwwEventSyncFilters,
  UwwEventSyncOptions,
  UwwEventSyncOptionsResponse,
  UwwEventSyncResponse,
} from "@training-platform/shared";
import { pool } from "../../db";
import { listCompetitions } from "./competition-query.service";

export const UWW_EVENTS_URL = "https://uww.org/events";

type SyncStatus = "added" | "updated" | "skipped";

interface UwwEventCandidate {
  title: string;
  location: string;
  country: string;
  startDate: string;
  endDate: string;
  level: CompetitionLevel;
  ageGroup: string;
  style: string;
  eventType: string;
  sourceUrl: string;
  sourceId: string;
}

interface ExistingCompetitionRow {
  id: string;
  title: string;
  federation: string;
  location: string;
  start_date: string;
  end_date: string;
  level: CompetitionLevel;
  age_group: string;
  description: string;
}

export class UwwEventSyncServiceError extends Error {
  constructor(
    public readonly code: "fetch_failed" | "parse_failed",
    message: string,
  ) {
    super(message);
    this.name = "UwwEventSyncServiceError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function cleanText(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanListText(value: unknown) {
  return cleanText(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function splitListText(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getEventSourceUrl(rawEvent: Record<string, unknown>) {
  const path = asRecord(rawEvent.path);
  const alias = cleanText(path?.alias);

  if (!alias) {
    return UWW_EVENTS_URL;
  }

  return new URL(alias, UWW_EVENTS_URL).toString();
}

function mapUwwLevel(eventType: string, title: string): CompetitionLevel {
  const source = `${eventType} ${title}`.toLowerCase();

  if (source.includes("olympic")) {
    return "olympics";
  }

  if (source.includes("world")) {
    return "world";
  }

  if (
    source.includes("continental") ||
    source.includes("european") ||
    source.includes("asian") ||
    source.includes("pan-american") ||
    source.includes("african") ||
    source.includes("oceania")
  ) {
    return "continental";
  }

  if (source.includes("ranking series") || source.includes("games")) {
    return "world";
  }

  return "continental";
}

function normalizeUwwEvent(rawEvent: unknown): UwwEventCandidate | null {
  const event = asRecord(rawEvent);

  if (!event || event.status === false) {
    return null;
  }

  const title = cleanText(event.title);
  const startDate = cleanText(event.event_start_date);
  const endDate = cleanText(event.event_end_date) || startDate;

  if (!title || !isDateKey(startDate) || !isDateKey(endDate)) {
    return null;
  }

  const city = cleanText(event.city);
  const country = cleanText(event.field_country);
  const eventType = cleanText(event.field_event_type || event.field_branding);
  const sourceUrl = getEventSourceUrl(event);
  const sourceId =
    cleanText(event.field_drupal_id) ||
    cleanText(asRecord(event.path)?.pid) ||
    `${title}-${startDate}`;

  return {
    title,
    location: [city, country].filter(Boolean).join(", "),
    country,
    startDate,
    endDate,
    level: mapUwwLevel(eventType, title),
    ageGroup: cleanListText(event.field_age),
    style: cleanListText(event.field_sport),
    eventType,
    sourceUrl,
    sourceId,
  };
}

function extractUwwEventsFromHtml(html: string) {
  const events: UwwEventCandidate[] = [];
  const seenKeys = new Set<string>();
  const assignments = html.matchAll(/window\["[^"]+"\]\s*=\s*"([^"]+)"/g);

  for (const assignment of assignments) {
    const encodedWidget = assignment[1];

    if (!encodedWidget.includes("eventList%22%3A%5B")) {
      continue;
    }

    let widget: unknown;

    try {
      widget = JSON.parse(decodeURIComponent(encodedWidget));
    } catch {
      continue;
    }

    const eventList = asRecord(widget)?.eventList;

    if (!Array.isArray(eventList)) {
      continue;
    }

    for (const rawEvent of eventList) {
      const event = normalizeUwwEvent(rawEvent);

      if (!event) {
        continue;
      }

      const key = `${event.sourceId}|${event.title}|${event.startDate}|${event.endDate}`;

      if (seenKeys.has(key)) {
        continue;
      }

      seenKeys.add(key);
      events.push(event);
    }
  }

  return events.sort((left, right) =>
    left.startDate.localeCompare(right.startDate) ||
    left.title.localeCompare(right.title),
  );
}

function normalizeFilters(filters?: Partial<UwwEventSyncFilters>): UwwEventSyncFilters {
  return {
    year: cleanText(filters?.year),
    ageGroup: cleanText(filters?.ageGroup),
    style: cleanText(filters?.style),
    eventType: cleanText(filters?.eventType),
    country: cleanText(filters?.country),
  };
}

function addSortedOption(set: Set<string>, value: string) {
  const cleanValue = cleanText(value);

  if (cleanValue) {
    set.add(cleanValue);
  }
}

function buildUwwEventOptions(events: UwwEventCandidate[]): UwwEventSyncOptions {
  const years = new Set<string>();
  const ageGroups = new Set<string>();
  const styles = new Set<string>();
  const eventTypes = new Set<string>();
  const countries = new Set<string>();

  for (const event of events) {
    addSortedOption(years, event.startDate.slice(0, 4));
    addSortedOption(eventTypes, event.eventType);
    addSortedOption(countries, event.country);

    for (const ageGroup of splitListText(event.ageGroup)) {
      addSortedOption(ageGroups, ageGroup);
    }

    for (const style of splitListText(event.style)) {
      addSortedOption(styles, style);
    }
  }

  return {
    years: [...years].sort((left, right) => right.localeCompare(left)),
    ageGroups: [...ageGroups].sort((left, right) => left.localeCompare(right)),
    styles: [...styles].sort((left, right) => left.localeCompare(right)),
    eventTypes: [...eventTypes].sort((left, right) => left.localeCompare(right)),
    countries: [...countries].sort((left, right) => left.localeCompare(right)),
  };
}

function matchesFilterList(value: string, selectedValue: string) {
  if (!selectedValue) {
    return true;
  }

  return splitListText(value).some(
    (item) => item.toLowerCase() === selectedValue.toLowerCase(),
  );
}

function filterUwwEvents(
  events: UwwEventCandidate[],
  filters: UwwEventSyncFilters,
) {
  return events.filter((event) => {
    if (filters.year && event.startDate.slice(0, 4) !== filters.year) {
      return false;
    }

    if (!matchesFilterList(event.ageGroup, filters.ageGroup)) {
      return false;
    }

    if (!matchesFilterList(event.style, filters.style)) {
      return false;
    }

    if (
      filters.eventType &&
      event.eventType.toLowerCase() !== filters.eventType.toLowerCase()
    ) {
      return false;
    }

    if (filters.country && event.country.toLowerCase() !== filters.country.toLowerCase()) {
      return false;
    }

    return true;
  });
}

async function fetchUwwEventsHtml() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(UWW_EVENTS_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "TrainingPlatformCalendarSync/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new UwwEventSyncServiceError(
        "fetch_failed",
        `UWW events request failed with ${response.status}`,
      );
    }

    return response.text();
  } catch (error) {
    if (error instanceof UwwEventSyncServiceError) {
      throw error;
    }

    throw new UwwEventSyncServiceError(
      "fetch_failed",
      error instanceof Error ? error.message : "Unable to fetch UWW events",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function buildCompetitionDescription(event: UwwEventCandidate) {
  return [
    "Imported from UWW.",
    event.eventType ? `Type: ${event.eventType}.` : "",
    event.style ? `Styles: ${event.style}.` : "",
    event.sourceUrl ? `Details: ${event.sourceUrl}.` : "",
    event.sourceId ? `UWW ID: ${event.sourceId}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

async function findExistingCompetition(event: UwwEventCandidate) {
  const uwwIdPattern = event.sourceId ? `%UWW ID: ${event.sourceId}%` : null;
  const result = await pool.query<ExistingCompetitionRow>(
    `
      SELECT
        id,
        title,
        federation,
        location,
        start_date::text,
        end_date::text,
        level,
        age_group,
        description
      FROM competitions
      WHERE
        ($5::text IS NOT NULL AND description LIKE $5)
        OR (
          LOWER(title) = LOWER($1::text)
          AND start_date = $2::date
          AND end_date = $3::date
          AND TRIM(LOWER(location)) = TRIM(LOWER($4::text))
        )
      LIMIT 1
    `,
    [event.title, event.startDate, event.endDate, event.location, uwwIdPattern],
  );

  return result.rows[0] ?? null;
}

function matchesCompetition(
  existing: ExistingCompetitionRow,
  event: UwwEventCandidate,
  description: string,
) {
  return (
    existing.title === event.title &&
    existing.federation === "UWW" &&
    existing.location === event.location &&
    existing.start_date === event.startDate &&
    existing.end_date === event.endDate &&
    existing.level === event.level &&
    existing.age_group === event.ageGroup &&
    existing.description === description
  );
}

async function upsertUwwCompetition(event: UwwEventCandidate): Promise<SyncStatus> {
  const description = buildCompetitionDescription(event);
  const existing = await findExistingCompetition(event);

  if (existing) {
    if (matchesCompetition(existing, event, description)) {
      return "skipped";
    }

    await pool.query(
      `
        UPDATE competitions
        SET
          title = $1,
          federation = $2,
          location = $3,
          start_date = $4::date,
          end_date = $5::date,
          level = $6,
          age_group = $7,
          description = $8
        WHERE id = $9
      `,
      [
        event.title,
        "UWW",
        event.location,
        event.startDate,
        event.endDate,
        event.level,
        event.ageGroup,
        description,
        existing.id,
      ],
    );

    return "updated";
  }

  await pool.query(
    `
      INSERT INTO competitions (
        title,
        federation,
        location,
        start_date,
        end_date,
        level,
        age_group,
        description
      )
      VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8)
    `,
    [
      event.title,
      "UWW",
      event.location,
      event.startDate,
      event.endDate,
      event.level,
      event.ageGroup,
      description,
    ],
  );

  return "added";
}

export async function getUwwEventSyncOptions(): Promise<UwwEventSyncOptionsResponse> {
  const html = await fetchUwwEventsHtml();
  const events = extractUwwEventsFromHtml(html);

  if (events.length === 0) {
    throw new UwwEventSyncServiceError(
      "parse_failed",
      "UWW events page did not include a readable event list",
    );
  }

  return {
    sourceUrl: UWW_EVENTS_URL,
    options: buildUwwEventOptions(events),
  };
}

export async function syncUwwEvents(
  selectedFilters?: Partial<UwwEventSyncFilters>,
): Promise<UwwEventSyncResponse> {
  const html = await fetchUwwEventsHtml();
  const allEvents = extractUwwEventsFromHtml(html);

  if (allEvents.length === 0) {
    throw new UwwEventSyncServiceError(
      "parse_failed",
      "UWW events page did not include a readable event list",
    );
  }

  const filters = normalizeFilters(selectedFilters);
  const options = buildUwwEventOptions(allEvents);
  const events = filterUwwEvents(allEvents, filters);
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const event of events) {
    const status = await upsertUwwCompetition(event);

    if (status === "added") {
      addedCount += 1;
    } else if (status === "updated") {
      updatedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  return {
    sourceUrl: UWW_EVENTS_URL,
    filters,
    options,
    totalFound: events.length,
    addedCount,
    updatedCount,
    skippedCount,
    competitions: await listCompetitions(),
  };
}
