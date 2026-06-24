+++
title = "Error Handling"
+++

Turbine provides a custom error class and clear error messages to help you debug issues.

## TurbineError

All Turbine-specific errors are instances of `TurbineError`:

```typescript
import { TurbineError } from "dynamodb-turbine";

try {
  await users.put({ id: "123" }); // Missing required field
} catch (error) {
  if (error instanceof TurbineError) {
    console.error("Turbine error:", error.message);
  }
}
```

## Common Error Scenarios

### Schema Validation Errors

When data doesn't match your Zod schema:

```typescript
const users = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    email: z.string().email(),
    age: z.number().min(0),
  }),
  computed: { /* ... */ },
});

// Missing required field
await users.put({ id: "123" });
// Error: Required field 'email' is missing

// Invalid email format
await users.put({ id: "123", email: "not-an-email" });
// Error: Invalid email

// Invalid number
await users.put({ id: "123", email: "a@b.com", age: -5 });
// Error: Number must be greater than or equal to 0
```

### Invalid Index

When querying a non-existent index:

```typescript
const table = defineTable({
  name: "my-table",
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
    gsi1: { hashKey: "type" },
  },
});

// Querying undefined index
await users.query({
  index: "gsi2", // Does not exist
  // ...
});
// Error: Index 'gsi2' is not defined
```

### Missing Key Fields

When query keys don't match the index:

```typescript
// Index requires 'type' as hash key
await users.query({
  index: "gsi1",
  // Missing 'type' field
});
// Error: Missing required key 'type' for index 'gsi1'
```

## Error Handling Patterns

### Try-Catch

```typescript
async function createUser(data: UserInput) {
  try {
    return await users.put(data);
  } catch (error) {
    if (error instanceof TurbineError) {
      // Handle validation or configuration errors
      throw new Error(`Invalid user data: ${error.message}`);
    }
    // Re-throw other errors (network, permissions, etc.)
    throw error;
  }
}
```

### Checking Existence

```typescript
async function getUserOrThrow(id: string) {
  const user = await users.get({
    pk: ["user", id],
    sk: "profile",
  });

  if (!user) {
    throw new Error(`User not found: ${id}`);
  }

  return user;
}
```

### Handling DynamoDB Errors

DynamoDB client errors are passed through:

```typescript
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";

try {
  await users.put(data);
} catch (error) {
  if (error instanceof TurbineError) {
    // Turbine validation error
  } else if (error instanceof ConditionalCheckFailedException) {
    // DynamoDB condition failed
  } else {
    // Other errors (network, permissions)
  }
}
```

## Validation Before Operations

Use Zod's parse methods for pre-validation:

```typescript
const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
});

function validateUserInput(data: unknown) {
  const result = userSchema.safeParse(data);

  if (!result.success) {
    // Handle validation errors with detailed info
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return { success: false, errors };
  }

  return { success: true, data: result.data };
}
```

## Debugging Tips

### Enable Logging

Log operations for debugging:

```typescript
async function putWithLogging<T>(entity: Entity<any>, data: T) {
  console.log("PUT:", JSON.stringify(data, null, 2));

  try {
    const result = await entity.put(data);
    console.log("SUCCESS:", result);
    return result;
  } catch (error) {
    console.error("ERROR:", error);
    throw error;
  }
}
```

### Check Computed Field Values

Verify generated values:

```typescript
const users = defineEntity({
  table,
  schema: z.object({ /* ... */ }),
  computed: {
    pk: (u) => {
      const key = ["user", u.id];
      console.log("Generated pk:", key);
      return key;
    },
    sk: (u) => u.email,
  },
});
```

### Inspect DynamoDB Items

Check what's actually stored:

```typescript
const user = await users.put({
  id: "123",
  email: "alice@example.com",
  name: "Alice",
});

// The instance includes all attributes
console.log("Stored item:", {
  pk: user.pk,   // "user#123"
  sk: user.sk,   // "alice@example.com"
  id: user.id,
  email: user.email,
  name: user.name,
});
```

## Error Reference

| Error | Cause | Solution |
|-------|-------|----------|
| Schema validation failed | Data doesn't match Zod schema | Check required fields, types, and constraints |
| Index not defined | Query uses unknown index name | Verify index exists in `defineTable` |
| Missing key field | Query missing required key | Include all hash/range keys for the index |
| Invalid computed field value | Derived function returned invalid value | Check computed functions return strings, numbers, or arrays |

## Next Steps

- [Quick Start](/quick-start) - Review the basics
- [TypeScript](/typescript) - Leverage type safety to prevent errors
