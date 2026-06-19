# Turbine 🪭

[![NPM](https://img.shields.io/npm/v/dynamodb-turbine)](https://npmjs.com/package/dynamodb-turbine) ![License](https://img.shields.io/npm/l/dynamodb-turbine)

Entity mapping and query helpers for DynamoDB using Zod schemas and the AWS SDK v3. Define your table and entities once, then put, get, update, and query with type-safe objects.

- Small, direct, and type-friendly
- Derive composite keys, defaults, and computed fields from your data
- Works with your existing DynamoDB DocumentClient

## Getting started

Install the package, and `zod`:

```sh
npm install dynamodb-turbine zod
# or
yarn add dynamodb-turbine zod
```

Then start using it in your code:

```ts
import z from "zod";
import { defineTable, defineEntity } from "dynamodb-turbine";

// 1) Define your table and indexes
const table = defineTable({
  name: "my-dynamodb-table",
  indexes: {
    // Required main index named "table"
    table: { hashKey: "pk", rangeKey: "sk" },

    // Optional GSIs
    type_sk: { hashKey: "type", rangeKey: "sk" },
    sk_pk: { hashKey: "sk", rangeKey: "pk" },
  },
});

// 2) Define an entity
const users = defineEntity({
  table,
  schema: z.object({
    pk: z.string(),
    sk: z.string(),
    id: z.uuid(),
    email: z.email(),
    name: z.string().optional(),
    createdAt: z.iso.datetime().optional(),
    updatedAt: z.iso.datetime().optional(),
  }),
  // Derive fields from the input data
  computed: {
    pk: (u) => ["user", u.id], // becomes `user#{id}`
    sk: (u) => u.email,
    createdAt: (u) => u.createdAt || new Date().toISOString(),
    updatedAt: () => new Date().toISOString(),
  },
});

// 3) Use it
const user = await users.put({
  id: "00000000-0000-0000-0000-000000000001",
  email: "user@example.com",
});

// Instance-level update for convenience
await user.update({ name: "Randy Newman" });

// Or entity-level update (keys must be specified precisely)
await users.update(
  { pk: ["user", user.id], sk: user.email },
  { email: "randy@example.com" },
);

// Lookups - keys must be specified precisely
const byPrimaryKey = await users.get({ pk: ["user", user.id], sk: user.email });
const one = await users.queryOne({
  pk: ["user", user.id],
  sk: { beginsWith: "user@" },
});
const all = await users.queryAll({ pk: ["user", user.id] });

// Conditional writes - only update if the item already exists
await users.update(
  { pk: ["user", user.id], sk: user.email },
  { name: "Randy Newman" },
  { conditions: { email: { exists: true } } },
);

// Conditional put - only insert if no item with this pk/sk exists yet
await users.put(
  { id: "00000000-0000-0000-0000-000000000002", email: "new@example.com" },
  { conditions: { pk: { notExists: true } } },
);

// Conditional delete - only delete if the name matches
await users.delete(
  { pk: ["user", user.id], sk: user.email },
  { conditions: { name: "Randy Newman" } },
);
```

## Defining tables

- You must define at least one index named `table`. This specifies the primary keys for your default index.
- The `hashKey` and optional `rangeKey` must match the attribute names you'll store on items (for example `pk`/`sk`).
- You can add GSIs by name. Use those attribute names in your entity's computed fields.

Optionally pass your own `DynamoDBDocumentClient` via `documentClient` to reuse configuration. By default, a client is created with `convertEmptyValues: true` and `removeUndefinedValues: true`.

```ts
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient());

const table = defineTable({
  name: "my-dynamodb-table",
  documentClient,
  indexes: { table: { hashKey: "pk", rangeKey: "sk" } },
});
```

## Defining entities

- `schema` is a Zod object. It drives validation and types for the input data.
- `computed` computes fields that are written to the item alongside the schema fields (e.g. `pk`, `sk`, `type`, timestamps).
  - A computed value can be a string, a function, or an array of parts; arrays are joined with `#`.
  - Derived functions receive the validated schema data and return the computed value.
  - Fields listed in `computed` become optional in `put` input (since they are computed).
  - Returned instances include both schema and computed fields.

Example:

```ts
const user = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    email: z.email(),
  }),
  computed: {
    type: () => "user",
    pk: (u) => ["user", u.id], // => "user#123"
    sk: (u) => u.email,
  },
});
```

## Operations

- `put(data, options?)`: validates with Zod, computes computed fields, writes, and returns the parsed instance.
- `get(key)`: requires key specification using actual key names (e.g., `pk`, `sk`), reads, returns instance or null.
- `update(key, patch, options?)`: requires key specification, validates/expands, updates, and returns the new instance. The patch can include both schema and computed fields.
- `query(key, options?)`: requires key specification; supports partial expressions like `{beginsWith: "prefix"}`. Returns a paged array with `lastEvaluatedKey` and `next()`.
- `queryOne(key, options?)`: first match or null.
- `queryAll(key, options?)`: collects all pages for convenience.
- `delete(key, options?)`: requires key specification, deletes the item.

### Key Specification

Keys must be specified precisely using the actual names specified in your table. Key arrays are automatically converted to strings joined with `#`. TypeScript enforces the correct shape for each index — the hash key is required and the range key is typed as a `RangeKeyConditionExpression`.

```ts
// Get with precise keys
await users.get({ pk: ["user", "123"], sk: "user@example.com" });

// Range key accepts expression objects
await users.queryOne({
  pk: ["user", "123"],
  sk: { beginsWith: "user@" },
});

// Query a GSI — TypeScript constrains the key shape to that index
await posts.query({
  index: "type_sk",
  // Now type must be specified
  type: "comment",
  sk: { beginsWith: "user#123#" },
});
```

Query options match DynamoDB's `QueryCommandInput` (minus the expression fields that Turbine builds for you), so you can set things like `Limit`, `ExclusiveStartKey`, `ScanIndexForward`, `ConsistentRead`, etc.

### Condition Expressions

`put`, `update`, and `delete` accept an optional `conditions` map. Each key is a schema field name (dot-notation supported for nested fields) and the value is a `FilterExpression`. The condition must be satisfied for the write to proceed; otherwise DynamoDB throws a `ConditionalCheckFailedException`.

```ts
// Only insert if no item with this pk exists yet
await users.put(
  { id: "00000000-0000-0000-0000-000000000002", email: "new@example.com" },
  { conditions: { pk: { notExists: true } } },
);

// Only update if the item already exists
await users.update(
  { pk: ["user", user.id], sk: user.email },
  { name: "Randy Newman" },
  { conditions: { email: { exists: true } } },
);

// Only delete if a specific value matches
await users.delete(
  { pk: ["user", user.id], sk: user.email },
  { conditions: { name: "Randy Newman" } },
);

// Nested field condition using dot-notation
await users.update(
  { pk: ["user", user.id], sk: user.email },
  { name: "Randy Newman" },
  { conditions: { "address.country": "US" } },
);
```

Available condition expressions:

| Expression | Meaning |
|---|---|
| `{ exists: true }` | Attribute must exist |
| `{ notExists: true }` | Attribute must not exist |
| `{ equals: value }` | Attribute equals value |
| `{ beginsWith: prefix }` | String attribute begins with prefix |
| `{ between: [lo, hi] }` | Attribute is between two values (inclusive) |
| `value` (primitive) | Shorthand for `{ equals: value }` |

### Update Expressions

The `update` patch accepts expression objects alongside plain values to leverage DynamoDB's atomic update operations:

```ts
await users.update(
  { pk: ["user", user.id], sk: user.email },
  {
    name: "Alice",                    // plain SET
    loginCount: { increment: 1 },     // SET #x = #x + :x
    credits: { decrement: 5 },        // SET #x = #x - :x
    tags: { append: ["new"] },        // SET #x = list_append(#x, :x)
    history: { prepend: ["latest"] }, // SET #x = list_append(:x, #x)
    bio: { ifNotExists: "default" },  // SET #x = if_not_exists(#x, :x)
    roles: { addToSet: ["admin"] },   // ADD #x :x
    oldRoles: { deleteFromSet: ["guest"] }, // DELETE #x :x
    temp: { remove: true },           // REMOVE #x
  },
);
```

| Expression | DynamoDB action |
|---|---|
| `{ increment: n }` | `SET #x = #x + :x` |
| `{ decrement: n }` | `SET #x = #x - :x` |
| `{ append: list }` | `SET #x = list_append(#x, :x)` |
| `{ prepend: list }` | `SET #x = list_append(:x, #x)` |
| `{ ifNotExists: value }` | `SET #x = if_not_exists(#x, :x)` |
| `{ addToSet: value }` | `ADD #x :x` |
| `{ deleteFromSet: value }` | `DELETE #x :x` |
| `{ remove: true }` | `REMOVE #x` |
| `null` | `REMOVE #x` |

## Types and validation

- Inputs are validated by your Zod schema (defaults apply too).
- Returned instances are typed as the combined schema + computed fields, and include an `update(patch)` helper that delegates to `entity.update`.

## Error handling

Invalid input or unresolved computed fields throw an error. Ensure required fields for the index you target are provided (for example, missing `pk` or `sk` parts in your computed fields).
