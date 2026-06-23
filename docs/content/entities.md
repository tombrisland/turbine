+++
title = "Entities"
+++

Entities are the core building block of Turbine. They define your data model with a Zod schema and specify how computed fields are generated.

## Basic Usage

```typescript
import { defineEntity } from "dynamodb-turbine";
import { z } from "zod";

const users = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
  }),
  computed: {
    pk: (user) => ["user", user.id],
    sk: (user) => user.email,
  },
});
```

## Entity Definition

The `defineEntity` function accepts:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `table` | `Table` | Yes | The table from `defineTable` |
| `schema` | `z.ZodObject` | Yes | A Zod object schema |
| `computed` | `object` | No | Computed field definitions |

## Schema Definition

Use any Zod object schema to define your entity structure:

```typescript
schema: z.object({
  // Required fields
  id: z.string(),
  email: z.string().email(),

  // Optional fields
  name: z.string().optional(),
  age: z.number().optional(),

  // Fields with defaults
  role: z.enum(["user", "admin"]).default("user"),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),

  // Complex types
  tags: z.array(z.string()).default(() => []),
  metadata: z.record(z.string(), z.unknown()).optional(),

  // Nested objects
  address: z.object({
    street: z.string(),
    city: z.string(),
    country: z.string(),
  }).optional(),
})
```

### Supported Zod Types

Turbine supports all Zod types that can be serialized to JSON:

- `z.string()`, `z.number()`, `z.boolean()`
- `z.array()`, `z.object()`, `z.record()`
- `z.enum()`, `z.union()`, `z.literal()`
- `z.optional()`, `z.nullable()`
- `z.default()`, `z.transform()`
- Validation methods like `.email()`, `.uuid()`, `.min()`, `.max()`

## Computed Field Definitions

Computed fields determine how items are stored and retrieved in DynamoDB. Each computed field can be:

### Static Values

```typescript
computed: {
  type: () => "user",
}
```

### Field References

```typescript
computed: {
  pk: (entity) => entity.id,
  sk: (entity) => entity.email,
}
```

### Composite Keys (Arrays)

Arrays are automatically joined with `#`:

```typescript
computed: {
  pk: (user) => ["user", user.id],     // becomes "user#<id>"
  sk: (user) => ["profile", user.email], // becomes "profile#<email>"
}
```

### Computed Values

```typescript
computed: {
  createdAt: (entity) => entity.createdAt || new Date().toISOString(),
  updatedAt: () => new Date().toISOString(),
}
```

### Example: Full Computed Field Definition

```typescript
const posts = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    authorId: z.string(),
    title: z.string(),
    content: z.string(),
    createdAt: z.string().datetime().default(() => new Date().toISOString()),
  }),
  computed: {
    // Primary key
    pk: (post) => ["user", post.authorId],
    sk: (post) => ["post", post.createdAt, post.id],

    // GSI for querying all posts by date
    type: () => "post",
    gsi1pk: () => "post",
    gsi1sk: (post) => [post.createdAt, post.id],

    // GSI for fetching post by ID
    gsi2pk: () => "post#id",
    gsi2sk: (post) => post.id,
  },
});
```

## Entity Methods

The returned entity object provides these methods:

### put(data)

Create a new item:

```typescript
const user = await users.put({
  id: "123",
  email: "alice@example.com",
  name: "Alice",
});
```

### get(key)

Fetch a single item:

```typescript
const user = await users.get({
  pk: ["user", "123"],
  sk: "alice@example.com",
});
```

### update(key, patch)

Update an existing item:

```typescript
const updated = await users.update(
  { pk: ["user", "123"], sk: "alice@example.com" },
  { name: "Alice Smith" }
);
```

### delete(key)

Remove an item:

```typescript
await users.delete({
  pk: ["user", "123"],
  sk: "alice@example.com",
});
```

### query(key, options?)

Query with pagination:

```typescript
const results = await users.query(
  { pk: ["user", "123"] },
  { Limit: 10 }
);
```

### queryOne(key, options?)

Get the first matching item:

```typescript
const user = await users.queryOne({
  index: "gsi2",
  gsi2pk: "user#email",
  gsi2sk: "alice@example.com",
});
```

### queryAll(key, options?)

Get all matching items (handles pagination):

```typescript
const allPosts = await posts.queryAll({
  pk: ["user", "123"],
});
```

## Entity Properties

```typescript
const users = defineEntity({ /* ... */ });

users.definition  // The original entity definition
```

## Next Steps

- [CRUD Operations](/crud) - Detailed guide to create, read, update, delete
- [Querying](/querying) - Advanced query patterns
- [TypeScript](/typescript) - Type inference and Instance types
