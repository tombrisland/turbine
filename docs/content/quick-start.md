+++
title = "Quick Start"
+++

Get up and running with Turbine in just a few minutes.

## Prerequisites

- Node.js 18+
- An AWS account with DynamoDB access
- AWS credentials configured (via environment variables, AWS CLI, or IAM role)

## Installation

Install Turbine and Zod:

```bash
npm install dynamodb-turbine zod
```

## Step 1: Define Your Table

First, define your DynamoDB table structure. Turbine needs to know about your table's indexes:

```typescript
import { defineTable } from "dynamodb-turbine";

const table = defineTable({
  name: "my-app-table",
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
    gsi1: { hashKey: "type", rangeKey: "createdAt" },
  },
});
```

The `table` index is your primary key. Additional indexes (like `gsi1`) are Global Secondary Indexes.

## Step 2: Define an Entity

Create an entity with a Zod schema for validation:

```typescript
import { defineEntity } from "dynamodb-turbine";
import { z } from "zod";

const users = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(["user", "admin"]).default("user"),
    createdAt: z.string().datetime().default(() => new Date().toISOString()),
  }),
  computed: {
    type: () => "user",
    pk: (user) => ["user", user.id],
    sk: (user) => ["profile", user.email],
  },
});
```

Computed field functions receive the entity data and return values that become DynamoDB attributes. Arrays are automatically joined with `#`.

## Step 3: Create Items

Use `put()` to create new items:

```typescript
const user = await users.put({
  id: "user-123",
  email: "alice@example.com",
  name: "Alice",
});

console.log(user.id);        // "user-123"
console.log(user.role);      // "user" (default value)
console.log(user.createdAt); // "2024-01-15T10:30:00.000Z"
```

## Step 4: Fetch Items

Use `get()` to fetch a single item by its keys:

```typescript
const user = await users.get({
  pk: ["user", "user-123"],
  sk: ["profile", "alice@example.com"],
});

if (user) {
  console.log(user.name); // "Alice"
}
```

## Step 5: Update Items

Update items using the entity method or the instance method:

```typescript
// Entity method - requires keys
await users.update(
  { pk: ["user", "user-123"], sk: ["profile", "alice@example.com"] },
  { name: "Alice Smith" }
);

// Instance method - more convenient
const user = await users.get({ pk: ["user", "user-123"], sk: ["profile", "alice@example.com"] });
await user?.update({ name: "Alice Smith" });
```

## Step 6: Query Items

Query for multiple items using indexes:

```typescript
// Query all users created in 2024
const users2024 = await users.queryAll({
  index: "gsi1",
  type: "user",
  createdAt: { beginsWith: "2024" },
});

// Query with pagination
const page1 = await users.query(
  { index: "gsi1", type: "user" },
  { Limit: 10 }
);

if (page1.next) {
  const page2 = await page1.next();
}
```

## Step 7: Delete Items

Remove items with `delete()`:

```typescript
await users.delete({
  pk: ["user", "user-123"],
  sk: ["profile", "alice@example.com"],
});
```

## Complete Example

Here's a complete working example:

```typescript
import { defineTable, defineEntity } from "dynamodb-turbine";
import { z } from "zod";

// Table definition
const table = defineTable({
  name: process.env.TABLE_NAME!,
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
    gsi1: { hashKey: "type", rangeKey: "createdAt" },
  },
});

// User entity
const users = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    createdAt: z.string().datetime().default(() => new Date().toISOString()),
  }),
  computed: {
    type: () => "user",
    pk: (u) => ["user", u.id],
    sk: (u) => ["profile", u.email],
  },
});

// Usage
async function main() {
  // Create
  const user = await users.put({
    id: "123",
    email: "alice@example.com",
    name: "Alice",
  });

  // Read
  const fetched = await users.get({
    pk: ["user", "123"],
    sk: ["profile", "alice@example.com"],
  });

  // Update
  await fetched?.update({ name: "Alice Smith" });

  // Query
  const allUsers = await users.queryAll({
    index: "gsi1",
    type: "user",
  });

  // Delete
  await users.delete({
    pk: ["user", "123"],
    sk: ["profile", "alice@example.com"],
  });
}
```

## Next Steps

- [Tables](/tables) - Learn about table configuration and indexes
- [Entities](/entities) - Deep dive into entity definitions
- [Querying](/querying) - Master query conditions and filters
