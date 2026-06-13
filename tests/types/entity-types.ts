import * as z from "zod";

import { defineEntity, defineTable } from "../../src";

const table = defineTable({
  name: "my-dynamodb-table",
  indexes: {
    table: {
      hashKey: "isbn",
      rangeKey: "title",
    },
    type_sk: {
      hashKey: "genre",
      rangeKey: "title",
    },
  },
});

const books = defineEntity({
  table,
  schema: z.object({
    isbn: z.string(),
    title: z.string(),
    genre: z.literal(["fiction", "non-fiction"]),
    description: z.string(),
    metadata: z.object({
      author: z.string(),
    }),
  }),
  keys: {
    isbn: (b) => b.isbn,
    title: (b) => b.title,
  },
});

// Valid key properties for the 'table' index
books.get({ isbn: { equals: "isbn1" }, title: { equals: "title1" } });
books.get({
  // @ts-expect-error Invalid key properties for index
  notPk: "isbn1",
  notSk: "title1",
});
// Invalid key properties for delete key expression
books.delete({
  // @ts-expect-error Invalid key properties for index
  notPk: "isbn1",
  notSk: "title1",
});
// Invalid key properties for query key expression
books.queryOne({
  // @ts-expect-error Invalid key properties for index
  notPk: "isbn1",
  notSk: "title1",
});
// Invalid key properties for key expression with index
books.queryOne({
  index: "type_sk",
  // @ts-expect-error Invalid key properties for index
  isbn: "isbn1",
  title: "title1",
});

// Filter property on nested field
books.query(
  { isbn: "isbn1" },
  {
    filters: {
      // Valid filter against top-level property
      description: { beginsWith: "desc1" },
      // Valid filter against nested property
      "metadata.author": { equals: "author1" },
      genre: {
        // @ts-expect-error Missing filter condition
        noFilter: "date1",
      },
    },
  },
);

// OR filter group
books.query(
  { isbn: "isbn1" },
  {
    filters: {
      or: [{ description: { beginsWith: "desc1" } }, { genre: "fiction" }],
    },
  },
);

// OR of AND blocks
books.query(
  { isbn: "isbn1" },
  {
    filters: {
      or: [
        { and: [{ description: { exists: true } }, { genre: "fiction" }] },
        { and: [{ genre: "non-fiction" }, { "metadata.author": "someone" }] },
      ],
    },
  },
);
