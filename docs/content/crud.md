+++
title = "CRUD Operations"
+++

Turbine provides simple methods for Create, Read, Update, and Delete operations.

## Create: put()

The `put()` method creates a new item in DynamoDB:

```typescript
const user = await users.put({
  id: "user-123",
  email: "alice@example.com",
  name: "Alice",
});
```

### Behavior

- Validates data against the Zod schema
- Applies default values from the schema
- Generates all computed field values
- Returns an Instance with the created data

### With Defaults

```typescript
const users = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    email: z.string().email(),
    role: z.enum(["user", "admin"]).default("user"),
    createdAt: z.string().datetime().default(() => new Date().toISOString()),
  }),
  computed: { /* ... */ },
});

const user = await users.put({
  id: "123",
  email: "alice@example.com",
});

console.log(user.role);      // "user" (default)
console.log(user.createdAt); // "2024-01-15T10:30:00.000Z" (generated)
```

### Overwrites Existing Items

`put()` will overwrite an existing item with the same keys:

```typescript
// Creates user
await users.put({ id: "123", email: "alice@example.com", name: "Alice" });

// Overwrites the entire item
await users.put({ id: "123", email: "alice@example.com", name: "Alice Smith" });
```

## Read: get()

The `get()` method fetches a single item by its primary key:

```typescript
const user = await users.get({
  pk: ["user", "123"],
  sk: ["profile", "alice@example.com"],
});

if (user) {
  console.log(user.name);
}
```

### Key Format

Keys must match the format defined in your entity:

```typescript
// If your computed fields are defined as:
computed: {
  pk: (u) => ["user", u.id],
  sk: (u) => u.email,
}

// Then get() expects:
await users.get({
  pk: ["user", "123"],  // Array format
  sk: "alice@example.com", // String format
});
```

### Returns

- Returns the Instance if found
- Returns `null` if not found

```typescript
const user = await users.get({ pk: ["user", "999"], sk: "missing" });
console.log(user); // null
```

## Update: update()

There are two ways to update items:

### Entity Method

Use `entity.update(key, patch)` when you have the keys:

```typescript
const updated = await users.update(
  { pk: ["user", "123"], sk: "alice@example.com" },
  { name: "Alice Smith", role: "admin" }
);
```

### Instance Method

Use `instance.update(patch)` for convenience when you have an instance:

```typescript
const user = await users.get({
  pk: ["user", "123"],
  sk: "alice@example.com",
});

if (user) {
  await user.update({ name: "Alice Smith" });
}
```

### Update Behavior

- Only updates the specified fields
- Validates the patch data against the schema
- Returns the updated Instance
- Mutates the instance object in-place (for instance method)

```typescript
const user = await users.get({ /* ... */ });
console.log(user.name); // "Alice"

await user.update({ name: "Alice Smith" });
console.log(user.name); // "Alice Smith" (updated in-place)
```

### Partial Updates

Only the fields you specify are updated:

```typescript
// Original: { id: "123", name: "Alice", role: "user", email: "alice@example.com" }

await users.update(
  { pk: ["user", "123"], sk: "alice@example.com" },
  { role: "admin" }
);

// Result: { id: "123", name: "Alice", role: "admin", email: "alice@example.com" }
```

## Delete: delete()

The `delete()` method removes an item:

```typescript
await users.delete({
  pk: ["user", "123"],
  sk: "alice@example.com",
});
```

### Behavior

- Deletes the item if it exists
- Does nothing if the item doesn't exist (no error)
- Returns `void`

## Error Handling

All operations can throw errors:

```typescript
import { TurbineError } from "dynamodb-turbine";

try {
  await users.put({ id: "123" }); // Missing required 'email'
} catch (error) {
  if (error instanceof TurbineError) {
    console.error("Validation failed:", error.message);
  }
}
```

Common errors:
- Schema validation failures
- Invalid computed field configurations
- DynamoDB client errors

## Complete Example

```typescript
import { defineTable, defineEntity } from "dynamodb-turbine";
import { z } from "zod";

const table = defineTable({
  name: "app-data",
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
  },
});

const users = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(["user", "admin"]).default("user"),
    createdAt: z.string().datetime().default(() => new Date().toISOString()),
    updatedAt: z.string().datetime().optional(),
  }),
  computed: {
    pk: (u) => ["user", u.id],
    sk: (u) => ["profile", u.email],
  },
});

async function userWorkflow() {
  // Create
  const user = await users.put({
    id: "user-123",
    email: "alice@example.com",
    name: "Alice",
  });
  console.log("Created:", user.id);

  // Read
  const fetched = await users.get({
    pk: ["user", "user-123"],
    sk: ["profile", "alice@example.com"],
  });
  console.log("Fetched:", fetched?.name);

  // Update (entity method)
  await users.update(
    { pk: ["user", "user-123"], sk: ["profile", "alice@example.com"] },
    { role: "admin", updatedAt: new Date().toISOString() }
  );

  // Update (instance method)
  const current = await users.get({
    pk: ["user", "user-123"],
    sk: ["profile", "alice@example.com"],
  });
  await current?.update({ name: "Alice Smith" });

  // Delete
  await users.delete({
    pk: ["user", "user-123"],
    sk: ["profile", "alice@example.com"],
  });
  console.log("Deleted");
}
```

## Next Steps

- [Querying](/querying) - Query multiple items
- [TypeScript](/typescript) - Type safety with Instance types
