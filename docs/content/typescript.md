+++
title = "TypeScript"
+++

Turbine is built with TypeScript and provides full type safety throughout your application.

## Instance Type

The `Instance` type represents the result of entity operations. Use it to type variables and function parameters:

```typescript
import type { Instance } from "dynamodb-turbine";

// Get the Instance type from your entity
type User = Instance<typeof users>;

function displayUser(user: User) {
  console.log(user.id);
  console.log(user.email);
  console.log(user.name);
}
```

### What Instance Includes

An Instance contains:

1. **All schema fields** - Every field from your Zod schema
2. **Computed field values** - The computed values stored in DynamoDB
3. **update() method** - Convenience method for updates

```typescript
const user = await users.put({
  id: "123",
  email: "alice@example.com",
  name: "Alice",
});

// Schema fields
user.id;    // string
user.email; // string
user.name;  // string

// Computed field values (also present as attributes)
user.pk;    // "user#123"
user.sk;    // "alice@example.com"

// Instance method
await user.update({ name: "Alice Smith" });
```

## Type Inference from Entities

TypeScript automatically infers types from your entity definitions:

```typescript
const users = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().optional(),
    role: z.enum(["user", "admin"]),
    createdAt: z.string().datetime(),
  }),
  computed: { /* ... */ },
});

// TypeScript knows the exact shape
const user = await users.put({
  id: "123",
  email: "alice@example.com",
  role: "admin", // Must be "user" | "admin"
  createdAt: new Date().toISOString(),
});

user.role;  // Type: "user" | "admin"
user.name;  // Type: string | undefined
```

## Type-Safe Operations

### put()

The input type is inferred from your schema, respecting optional fields and defaults:

```typescript
// Schema with defaults
schema: z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(["user", "admin"]).default("user"),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
})

// Only required fields needed
await users.put({
  id: "123",
  name: "Alice",
  // role and createdAt have defaults, so they're optional
});

// TypeScript error: missing 'name'
await users.put({
  id: "123",
});
```

### get() and query()

Return types are automatically `Instance | null` or `Instance[]`:

```typescript
const user = await users.get({ /* ... */ });
// Type: Instance<typeof users> | null

if (user) {
  // TypeScript knows user is not null here
  console.log(user.name);
}

const results = await users.queryAll({ /* ... */ });
// Type: Instance<typeof users>[]

results.forEach(user => {
  console.log(user.email); // TypeScript knows the shape
});
```

### update()

The patch type is a partial of your schema:

```typescript
// Entity update - accepts Partial<Schema>
await users.update(
  { pk: ["user", "123"], sk: "alice@example.com" },
  { name: "Alice Smith" } // Partial<Schema>
);

// Instance update - same partial type
await user.update({
  role: "admin", // Type-checked against schema
});

// TypeScript error: 'unknown' is not in schema
await user.update({
  unknown: "field",
});
```

## Using Instance in Functions

### Function Parameters

```typescript
type User = Instance<typeof users>;
type Post = Instance<typeof posts>;

function formatUser(user: User): string {
  return `${user.name} (${user.email})`;
}

async function publishPost(post: Post): Promise<Post> {
  return post.update({ status: "published" });
}
```

### Return Types

```typescript
type User = Instance<typeof users>;

async function getActiveUsers(): Promise<User[]> {
  return users.queryAll({
    type: "user",
  }, {
    filters: {
      status: "active",
    },
  });
}

async function findUserByEmail(email: string): Promise<User | null> {
  return users.queryOne({
    index: "byEmail",
    email,
  });
}
```

### Generic Functions

```typescript
import type { Entity, Instance } from "dynamodb-turbine";

// Generic function that works with any entity
async function countItems<E extends Entity<any>>(
  entity: E,
  key: Parameters<E["queryAll"]>[0]
): Promise<number> {
  const items = await entity.queryAll(key);
  return items.length;
}

const userCount = await countItems(users, { type: "user" });
const postCount = await countItems(posts, { type: "post" });
```

## Extracting Schema Types

You can extract the raw schema type (without Instance methods):

```typescript
import { z } from "zod";

const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
});

// Raw schema type (for validation, forms, etc.)
type UserData = z.infer<typeof userSchema>;

const users = defineEntity({
  table,
  schema: userSchema,
  computed: { /* ... */ },
});

// Instance type (includes update method)
type User = Instance<typeof users>;

// UserData for input validation
function validateUserInput(data: unknown): UserData {
  return userSchema.parse(data);
}

// User for database operations
async function createUser(data: UserData): Promise<User> {
  return users.put(data);
}
```

## Common Patterns

### Separating Entity and Types

```typescript
// entities/user.ts
import { defineEntity } from "dynamodb-turbine";
import type { Instance } from "dynamodb-turbine";
import { z } from "zod";
import { table } from "./table";

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["user", "admin"]).default("user"),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});

export const users = defineEntity({
  table,
  schema: userSchema,
  computed: {
    type: () => "user",
    pk: (u) => ["user", u.id],
    sk: (u) => ["profile", u.email],
  },
});

export type User = Instance<typeof users>;
export type UserInput = z.input<typeof userSchema>;
```

```typescript
// services/user-service.ts
import { users, type User, type UserInput } from "../entities/user";

export async function createUser(input: UserInput): Promise<User> {
  return users.put(input);
}

export async function getUserById(id: string): Promise<User | null> {
  // Implementation
}
```

### API Response Types

```typescript
type User = Instance<typeof users>;

// Omit internal fields for API responses
type UserResponse = Omit<User, "pk" | "sk" | "update">;

function toResponse(user: User): UserResponse {
  const { pk, sk, update, ...rest } = user;
  return rest;
}
```

## Next Steps

- [Computed Field Patterns](/key-patterns) - Design effective key structures
- [Error Handling](/errors) - Handle Turbine errors
