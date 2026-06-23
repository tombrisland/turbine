import * as z from "zod";

import { defineEntity, defineTable } from "../../src";

const table = defineTable({
  name: "test-table",
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
    type_sk: { hashKey: "type", rangeKey: "sk" },
  },
});

const books = defineEntity({
  table,
  schema: z.object({
    isbn: z.string(),
    title: z.string(),
    genre: z.literal(["fiction", "non-fiction"]),
    description: z.string(),
    metadata: z.object({ author: z.string() }),
    pk: z.string(),
    sk: z.string(),
    type: z.string(),
  }),
  computed: {
    pk: (b) => ["book", b.isbn],
    sk: (b) => b.title,
    type: () => "book",
  },
});

// ─── put ────────────────────────────────────────────────────────────────────

// computed fields are optional in input
books.put({
  isbn: "978-0-13-468599-1",
  title: "The Pragmatic Programmer",
  genre: "non-fiction",
  description: "A book about programming",
  metadata: { author: "Dave Thomas" },
});

// non-computed schema fields are still required
// @ts-expect-error missing required fields
books.put({ isbn: "978-0-13-468599-1" });

// computed fields can be explicitly provided
books.put({
  isbn: "978-0-13-468599-1",
  title: "The Pragmatic Programmer",
  genre: "non-fiction",
  description: "A book about programming",
  metadata: { author: "Dave Thomas" },
  type: "override",
});

// all fields required when no computed fields exist
const _simple = defineEntity({
  table,
  schema: z.object({ pk: z.string(), sk: z.string(), name: z.string() }),
});
// @ts-expect-error missing required field: name
_simple.put({ pk: "pk1", sk: "sk1" });

// ─── get ────────────────────────────────────────────────────────────────────

// accepts key with equals expression
books.get({ pk: { equals: "pk1" }, sk: { equals: "sk1" } });

// accepts key with primitive values
books.get({ pk: "book#123", sk: "title" });

// rejects invalid key properties
// @ts-expect-error invalid key properties
books.get({ notPk: "pk1", notSk: "sk1" });

// returns full schema type including computed fields
async function _testGetReturn() {
  const _book = await books.get({ pk: "book#123", sk: "title" });
  if (_book) {
    const _pk: string = _book.pk;
    const _isbn: string = _book.isbn;
  }
}

// ─── update ─────────────────────────────────────────────────────────────────

// accepts partial of full schema (input fields)
async function _testUpdateInput() {
  await books.update({ pk: "book#123", sk: "title" }, { description: "New" });
}

// accepts partial of full schema (computed fields)
async function _testUpdateComputed() {
  await books.update({ pk: "book#123", sk: "title" }, { type: "updated" });
}

// rejects invalid key properties
async function _testUpdateInvalidKey() {
  // @ts-expect-error invalid key properties
  await books.update({ notPk: "pk1", notSk: "sk1" }, { title: "x" });
}

// instance update accepts partial of full schema
async function _testInstanceUpdate() {
  const _book = await books.get({ pk: "book#123", sk: "title" });
  if (_book) {
    await _book.update({ description: "New" });
    await _book.update({ type: "new-type" });
  }
}

// ─── delete ─────────────────────────────────────────────────────────────────

// rejects invalid key properties
// @ts-expect-error invalid key properties
books.delete({ notPk: "pk1", notSk: "sk1" });

// ─── query ──────────────────────────────────────────────────────────────────

// accepts hash key only (range key optional)
books.query({ pk: "pk1" });

// rejects invalid key properties
// @ts-expect-error invalid key properties
books.queryOne({ notPk: "pk1", notSk: "sk1" });

// enforces correct key shape for GSI
// @ts-expect-error type_sk index requires 'type' not 'pk'
books.queryOne({ index: "type_sk", pk: "pk1", sk: "title1" });

// valid GSI query
books.queryOne({ index: "type_sk", type: "book" });

// returns full schema type
async function _testQueryReturn() {
  const _book = await books.queryOne({ pk: "book#123" });
  if (_book) {
    const _pk: string = _book.pk;
    const _title: string = _book.title;
  }
}

// ─── filters ────────────────────────────────────────────────────────────────

// accepts valid top-level and nested field conditions
books.query(
  { pk: "pk1" },
  {
    filters: {
      description: { beginsWith: "desc1" },
      "metadata.author": { equals: "author1" },
    },
  },
);

// rejects invalid filter operator
books.query(
  { pk: "pk1" },
  {
    filters: {
      // @ts-expect-error invalid filter operator
      genre: { noFilter: "date1" },
    },
  },
);

// accepts OR/AND filter groups
books.query(
  { pk: "pk1" },
  {
    filters: {
      or: [{ description: { beginsWith: "desc1" } }, { genre: "fiction" }],
    },
  },
);
