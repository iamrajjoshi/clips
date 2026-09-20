export type ReadingCategory = "read" | "reference" | "watch" | "skip";
export type ReadingStatus = "unread" | "done" | "filed" | "dismissed";

export interface ReadingItem {
  id: string;
  url: string;
  title: string;
  category: ReadingCategory;
  topic: string;
  priority: number;
  status: ReadingStatus;
  note: string;
  rationale: string;
  duplicateOf: string | null;
  sourceText: string;
  sourceLinks: string[];
}

const categories = new Set<ReadingCategory>(["read", "reference", "watch", "skip"]);
const statuses = new Set<ReadingStatus>(["unread", "done", "filed", "dismissed"]);

export function canonicalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.hostname === "twitter.com") url.hostname = "x.com";
    const queryKeys = Array.from(url.searchParams.keys());
    for (const key of queryKeys) {
      if (/^(utm_|ref$|source$|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function string(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readCategory(value: unknown): ReadingCategory {
  return categories.has(value as ReadingCategory) ? (value as ReadingCategory) : "read";
}

function readStatus(value: unknown, category: ReadingCategory): ReadingStatus {
  if (statuses.has(value as ReadingStatus)) return value as ReadingStatus;
  if (category === "reference") return "filed";
  if (category === "skip") return "dismissed";
  return "unread";
}

function readPriority(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? Math.max(0, Math.min(3, value)) : 2;
}

function readId(value: unknown): string {
  return string(value) || (typeof value === "number" ? String(value) : crypto.randomUUID());
}

function readDuplicate(row: Record<string, unknown>): string | null {
  const value = row.duplicateOf ?? row.duplicate_of;
  return value == null ? null : String(value);
}

export function parseReadingItem(value: unknown): ReadingItem | null {
  const row = object(value);
  if (!row) return null;
  const url = string(row.url);
  if (!canonicalUrl(url)) return null;
  const category = readCategory(row.category);
  const status = readStatus(row.status, category);
  const links = row.sourceLinks ?? row.source_links;
  return {
    id: readId(row.id),
    url,
    title: string(row.title) || new URL(url).hostname,
    category,
    topic: string(row.topic),
    priority: readPriority(row.priority),
    status,
    note: string(row.note),
    rationale: string(row.rationale),
    duplicateOf: readDuplicate(row),
    sourceText: string(row.sourceText ?? row.source_text),
    sourceLinks: Array.isArray(links)
      ? links.filter((link): link is string => typeof link === "string")
      : [],
  };
}

export function mergeReadingItems(
  existing: ReadingItem[],
  input: unknown,
): {
  items: ReadingItem[];
  added: number;
  duplicates: number;
  invalid: number;
} {
  const rows = Array.isArray(input) ? input : object(input)?.items;
  if (!Array.isArray(rows)) throw new Error("Choose a JSON array or an exported inbox file.");
  const items = existing.map((item) => ({ ...item }));
  const urls = new Set(existing.map((item) => canonicalUrl(item.url)));
  let added = 0;
  let duplicates = 0;
  let invalid = 0;
  for (const row of rows) {
    const item = parseReadingItem(row);
    if (!item) {
      invalid++;
      continue;
    }
    const key = canonicalUrl(item.url);
    if (urls.has(key)) {
      duplicates++;
      continue;
    }
    urls.add(key);
    items.push(item);
    added++;
  }
  // An import cannot expand the active queue beyond five.
  let active = 0;
  for (const item of items) {
    if (item.category === "read" && item.status === "unread" && item.priority === 1) {
      active++;
      if (active > 5) item.priority = 2;
    }
  }
  return { items, added, duplicates, invalid };
}

export function isUpNext(item: ReadingItem): boolean {
  return item.category === "read" && item.status === "unread" && item.priority === 1;
}
