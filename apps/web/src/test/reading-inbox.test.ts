import assert from "node:assert/strict";
import test from "node:test";
import { canonicalUrl, isUpNext, mergeReadingItems } from "../lib/reading-inbox";

test("imports the classified X inbox without publishing or losing its categories", () => {
  // This fixture models the source format; the personal 77-item data stays outside the public repo.
  const source = [
    {
      id: 1,
      url: "https://x.com/a/status/1",
      title: "Attention",
      category: "read",
      topic: "inference",
      priority: 1,
      status: "unread",
    },
    {
      id: 2,
      url: "https://x.com/b/status/2",
      title: "Tool",
      category: "reference",
      topic: "tools",
      priority: 0,
      status: "filed",
    },
    {
      id: 3,
      url: "https://x.com/c/status/3",
      title: "Reaction",
      category: "skip",
      priority: 0,
      status: "dismissed",
      duplicate_of: 1,
    },
  ];
  const imported = mergeReadingItems([], source);
  assert.equal(imported.added, 3);
  assert.equal(imported.items.filter(isUpNext).length, 1);
  assert.equal(imported.items[1].category, "reference");
  assert.equal(imported.items[2].duplicateOf, "1");

  imported.items[0].status = "done";
  const roundTrip = mergeReadingItems(
    [],
    JSON.parse(JSON.stringify({ version: 1, items: imported.items })),
  );
  assert.equal(roundTrip.items[0].status, "done");
});

test("deduplicates URLs and preserves reading progress during import", () => {
  const first = mergeReadingItems(
    [],
    [{ url: "https://twitter.com/a/status/1?utm_source=x", title: "First" }],
  );
  first.items[0].status = "done";
  const second = mergeReadingItems(first.items, [
    { url: "https://x.com/a/status/1", title: "Duplicate" },
    { url: "javascript:alert(1)", title: "Invalid" },
  ]);
  assert.deepEqual([second.added, second.duplicates, second.invalid], [0, 1, 1]);
  assert.equal(second.items[0].title, "First");
  assert.equal(second.items[0].status, "done");
  assert.equal(canonicalUrl("https://x.com/a/status/1#fragment"), "https://x.com/a/status/1");
});

test("limits imported active reads to five", () => {
  const rows = Array.from({ length: 7 }, (_, index) => ({
    url: `https://example.com/${index}`,
    title: `Item ${index}`,
    category: "read",
    status: "unread",
    priority: 1,
  }));
  const result = mergeReadingItems([], rows);
  assert.equal(result.items.filter(isUpNext).length, 5);
  assert.equal(result.items.filter((item) => item.priority === 2).length, 2);
});
