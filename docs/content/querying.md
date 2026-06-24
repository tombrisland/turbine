+++
title = "Querying"
+++

Turbine provides powerful query methods for retrieving multiple items from DynamoDB.

## Query Methods

### query()

Returns paginated results:

```typescript
const results = await users.query({
  pk: ["user", "123"],
});

console.log(results);        // Array of Instance objects
console.log(results.length); // Number of items in this page
```

### queryOne()

Returns the first matching item:

```typescript
const user = await users.queryOne({
  index: "byEmail",
  email: "alice@example.com",
});

if (user) {
  console.log(user.name);
}
```

### queryAll()

Fetches all pages automatically:

```typescript
const allUsers = await users.queryAll({
  type: "user",
});

// Returns all matching items, handling pagination internally
console.log(allUsers.length);
```

## Key Conditions

### Hash Key (Required)

Every query must specify a hash key with an equality condition:

```typescript
// Simple value
{ pk: "user#123" }

// Array (joined with #)
{ pk: ["user", "123"] }

// Explicit equals
{ pk: { equals: "user#123" } }
```

### Range Key (Optional)

Range keys support various operators:

```typescript
// Equality
{ sk: "profile" }
{ sk: { equals: "profile" } }

// Prefix matching
{ sk: { beginsWith: "post#2024" } }

// Comparisons
{ sk: { greaterThan: 100 } }
{ sk: { lessThan: 200 } }
{ sk: { greaterThanOrEquals: 100 } }
{ sk: { lessThanOrEquals: 200 } }

// Range
{ sk: { between: ["2024-01-01", "2024-12-31"] } }
```

## Index Selection

Use the `index` property to query a GSI:

```typescript
// Query the primary table index (default)
await posts.query({
  pk: ["user", "123"],
});

// Query a GSI
await posts.query({
  index: "gsi1",
  gsi1pk: "post",
  gsi1sk: { beginsWith: "2024-01" },
});
```

> The index name must match one defined in your `defineTable` call.

## Filter Expressions

Filters narrow results after the key conditions are applied:

```typescript
const activePosts = await posts.query(
  { pk: ["user", "123"] },
  {
    filters: {
      status: "published",
      deletedAt: { notExists: true },
    },
  }
);
```

### Filter Operators

```typescript
filters: {
  // Equality
  status: "active",
  status: { equals: "active" },
  status: { notEquals: "deleted" },

  // Comparisons
  count: { greaterThan: 10 },
  count: { lessThan: 100 },
  count: { greaterThanOrEquals: 10 },
  count: { lessThanOrEquals: 100 },

  // Range
  count: { between: [10, 100] },

  // String operations
  title: { beginsWith: "Hello" },
  title: { contains: "world" },
  title: { notContains: "spam" },

  // Existence checks
  deletedAt: { exists: true },
  deletedAt: { notExists: true },
}
```

## Pagination

### Manual Pagination

Use `query()` for manual control:

```typescript
// First page
const page1 = await users.query(
  { type: "user" },
  { Limit: 10 }
);

console.log(page1.length);           // Up to 10 items
console.log(page1.lastEvaluatedKey); // Cursor for next page

// Next page using the convenience function
if (page1.next) {
  const page2 = await page1.next();
}

// Or manually with ExclusiveStartKey
if (page1.lastEvaluatedKey) {
  const page2 = await users.query(
    { type: "user" },
    { Limit: 10, ExclusiveStartKey: page1.lastEvaluatedKey }
  );
}
```

### Automatic Pagination

Use `queryAll()` to fetch everything:

```typescript
const allUsers = await users.queryAll({
  type: "user",
});

// Handles all pagination internally
console.log(allUsers.length);
```

> Be careful with `queryAll()` on large datasets as it fetches everything.

## Query Options

Pass DynamoDB query options as the second argument:

```typescript
const results = await posts.query(
  { pk: ["user", "123"] },
  {
    // Pagination
    Limit: 20,
    ExclusiveStartKey: lastKey,

    // Sort order (false = descending)
    ScanIndexForward: false,

    // Consistency
    ConsistentRead: true,

    // Filters
    filters: {
      status: "published",
    },
  }
);
```

### Common Options

| Option | Type | Description |
|--------|------|-------------|
| `Limit` | `number` | Maximum items to return |
| `ExclusiveStartKey` | `object` | Start position for pagination |
| `ScanIndexForward` | `boolean` | `true` = ascending, `false` = descending |
| `ConsistentRead` | `boolean` | Use strongly consistent reads |
| `filters` | `object` | Filter expressions |

## Examples

### Get Latest Posts

```typescript
const latestPosts = await posts.query(
  {
    index: "gsi1",
    gsi1pk: "post",
    gsi1sk: { beginsWith: "2024" },
  },
  {
    Limit: 10,
    ScanIndexForward: false, // Newest first
  }
);
```

### Find User by Email

```typescript
const user = await users.queryOne({
  index: "byEmail",
  email: "alice@example.com",
});
```

### Get All User's Active Posts

```typescript
const activePosts = await posts.queryAll(
  { pk: ["user", userId] },
  {
    filters: {
      status: "published",
      deletedAt: { notExists: true },
    },
  }
);
```

### Paginated Feed

```typescript
async function getFeed(cursor?: Record<string, unknown>) {
  const page = await posts.query(
    {
      index: "gsi1",
      gsi1pk: "post",
    },
    {
      Limit: 20,
      ScanIndexForward: false,
      ExclusiveStartKey: cursor,
      filters: {
        status: "published",
      },
    }
  );

  return {
    items: page,
    nextCursor: page.lastEvaluatedKey,
    hasMore: !!page.next,
  };
}
```

### Date Range Query

```typescript
const postsInJanuary = await posts.queryAll({
  index: "gsi1",
  gsi1pk: "post",
  gsi1sk: { between: ["2024-01-01", "2024-01-31"] },
});
```

## Next Steps

- [Computed Field Patterns](/key-patterns) - Design effective key structures
- [TypeScript](/typescript) - Type safety with queries
