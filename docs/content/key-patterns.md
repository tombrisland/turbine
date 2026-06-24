+++
title = "Computed Field Patterns"
+++

Effective key design is crucial for DynamoDB performance. Turbine makes it easy to implement common patterns using computed fields.

## How Computed Fields Work

In Turbine, computed fields are defined as functions that transform your entity data into DynamoDB attributes:

```typescript
computed: {
  pk: (user) => ["user", user.id],     // "user#123"
  sk: (user) => ["profile", user.email], // "profile#alice@example.com"
}
```

### Array Joining

Arrays are automatically joined with `#`:

```typescript
["user", "123"]           // becomes "user#123"
["post", "2024-01-15", "abc"] // becomes "post#2024-01-15#abc"
```

### Key Types

| Type | Example | Result |
|------|---------|--------|
| String | `"user"` | `"user"` |
| Number | `123` | `123` |
| Array | `["user", id]` | `"user#<id>"` |
| Function | `() => "static"` | `"static"` |

## Single-Table Design

Single-table design stores multiple entity types in one table, using key prefixes to differentiate them.

### Entity Type Prefix

```typescript
const users = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
  }),
  computed: {
    type: () => "user",
    pk: (u) => ["user", u.id],
    sk: () => "profile",
  },
});

const posts = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    authorId: z.string(),
    title: z.string(),
  }),
  computed: {
    type: () => "post",
    pk: (p) => ["user", p.authorId],
    sk: (p) => ["post", p.id],
  },
});
```

### Query by Entity Type

Use a GSI with `type` as the hash key:

```typescript
// Get all users
const allUsers = await users.queryAll({
  index: "gsi1",
  type: "user",
});

// Get all posts
const allPosts = await posts.queryAll({
  index: "gsi1",
  type: "post",
});
```

## Common Access Patterns

### One-to-Many Relationships

Store related items under the same partition key:

```typescript
// User owns posts
const posts = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    authorId: z.string(),
    title: z.string(),
    createdAt: z.string().datetime(),
  }),
  computed: {
    pk: (p) => ["user", p.authorId],
    sk: (p) => ["post", p.createdAt, p.id],
  },
});

// Get all posts by user, sorted by date
const userPosts = await posts.queryAll({
  pk: ["user", userId],
  sk: { beginsWith: "post#" },
});
```

### Lookup by ID

Create a GSI for direct ID lookups:

```typescript
const posts = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    authorId: z.string(),
    title: z.string(),
  }),
  computed: {
    pk: (p) => ["user", p.authorId],
    sk: (p) => ["post", p.id],
    // GSI for ID lookup
    gsi1pk: () => "post#id",
    gsi1sk: (p) => p.id,
  },
});

// Fetch by ID (when you don't know the author)
const post = await posts.queryOne({
  index: "gsi1",
  gsi1pk: "post#id",
  gsi1sk: postId,
});
```

### Unique Constraints

Use a GSI to enforce uniqueness:

```typescript
const users = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    email: z.string().email(),
    username: z.string(),
  }),
  computed: {
    pk: (u) => ["user", u.id],
    sk: () => "profile",
    // GSI for email lookup (unique)
    gsi1pk: () => "user#email",
    gsi1sk: (u) => u.email,
    // GSI for username lookup (unique)
    gsi2pk: () => "user#username",
    gsi2sk: (u) => u.username,
  },
});

// Check if email exists
const existing = await users.queryOne({
  index: "gsi1",
  gsi1pk: "user#email",
  gsi1sk: email,
});
```

### Timeline / Feed

Sort items by timestamp:

```typescript
const posts = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    authorId: z.string(),
    title: z.string(),
    createdAt: z.string().datetime(),
  }),
  computed: {
    pk: (p) => ["user", p.authorId],
    sk: (p) => ["post", p.createdAt, p.id],
    // Global feed GSI
    type: () => "post",
    gsi1pk: () => "post#feed",
    gsi1sk: (p) => [p.createdAt, p.id],
  },
});

// User's posts (newest first)
const userPosts = await posts.query(
  { pk: ["user", userId], sk: { beginsWith: "post#" } },
  { ScanIndexForward: false, Limit: 20 }
);

// Global feed (newest first)
const feed = await posts.query(
  { index: "gsi1", gsi1pk: "post#feed" },
  { ScanIndexForward: false, Limit: 20 }
);
```

### Hierarchical Data

Model hierarchies with composite keys:

```typescript
// Organization > Team > Member
const members = defineEntity({
  table,
  schema: z.object({
    orgId: z.string(),
    teamId: z.string(),
    userId: z.string(),
    role: z.string(),
  }),
  computed: {
    pk: (m) => ["org", m.orgId],
    sk: (m) => ["team", m.teamId, "member", m.userId],
  },
});

// All members in an org
await members.queryAll({
  pk: ["org", orgId],
  sk: { beginsWith: "team#" },
});

// All members in a specific team
await members.queryAll({
  pk: ["org", orgId],
  sk: { beginsWith: ["team", teamId, "member"] },
});
```

## Key Design Tips

### Use Consistent Prefixes

Prefix partition keys with entity type for clarity:

```typescript
// Good: Clear prefixes
pk: (u) => ["user", u.id]
pk: (p) => ["post", p.id]
pk: (o) => ["order", o.id]

// Avoid: Ambiguous keys
pk: (u) => u.id
```

### Include Timestamp for Sorting

When you need chronological ordering, include timestamps in sort keys:

```typescript
// Good: Sortable by time
sk: (p) => [p.createdAt, p.id]

// The ID at the end ensures uniqueness if timestamps collide
```

### Use ISO Timestamps

ISO format strings sort correctly as strings:

```typescript
createdAt: z.string().datetime().default(() => new Date().toISOString())

// Results: "2024-01-15T10:30:00.000Z" sorts before "2024-02-01T08:00:00.000Z"
```

### Plan Your GSIs

Design GSIs based on your access patterns:

| Access Pattern | GSI Design |
|----------------|------------|
| Get all entities of a type | `hashKey: type` |
| Lookup by unique field | `hashKey: "entity#field", rangeKey: value` |
| Timeline/feed | `hashKey: "entity#feed", rangeKey: timestamp` |
| Filter by status | `hashKey: status, rangeKey: timestamp` |

## Example: Complete Entity Design

```typescript
const posts = defineEntity({
  table,
  schema: z.object({
    id: z.string().uuid(),
    authorId: z.string(),
    title: z.string(),
    content: z.string(),
    status: z.enum(["draft", "published", "archived"]),
    createdAt: z.string().datetime().default(() => new Date().toISOString()),
    updatedAt: z.string().datetime().optional(),
  }),
  computed: {
    // Primary: User's posts sorted by date
    pk: (p) => ["user", p.authorId],
    sk: (p) => ["post", p.createdAt, p.id],

    // GSI1: All posts by type
    type: () => "post",

    // GSI2: Global feed
    gsi1pk: () => "post#feed",
    gsi1sk: (p) => [p.createdAt, p.id],

    // GSI3: Lookup by ID
    gsi2pk: () => "post#id",
    gsi2sk: (p) => p.id,

    // GSI4: Posts by status
    gsi3pk: (p) => ["post#status", p.status],
    gsi3sk: (p) => [p.createdAt, p.id],
  },
});

// Access patterns enabled:
// 1. Get user's posts: query pk=user#<id>
// 2. Get all posts: query gsi1 type=post
// 3. Global feed: query gsi2 gsi1pk=post#feed
// 4. Lookup by ID: query gsi3 gsi2pk=post#id, gsi2sk=<id>
// 5. Posts by status: query gsi4 gsi3pk=post#status#published
```

## Next Steps

- [Querying](/querying) - Use your computed fields effectively
- [Error Handling](/errors) - Handle computed field errors
