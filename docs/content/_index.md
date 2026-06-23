+++
title = "Turbine"
+++

# Turbine

<p class="lead">A type-safe entity mapping and query library for DynamoDB.</p>

Turbine makes working with DynamoDB simple and type-safe. Define your entities with Zod schemas, and Turbine handles the rest: key generation, validation, queries, and pagination.

## Features

- **Type-safe** - Full TypeScript support with Zod schema validation
- **Simple API** - Intuitive `defineTable` and `defineEntity` functions
- **Flexible keys** - Computed fields for composite keys, computed values, and automatic joining
- **Powerful queries** - Key conditions, filters, and built-in pagination
- **Instance methods** - Convenient `update()` on returned objects

## Installation

```bash
npm install dynamodb-turbine zod
```

or with yarn:

```bash
yarn add dynamodb-turbine zod
```

## Quick Example

```typescript
import { defineTable, defineEntity } from "dynamodb-turbine";
import { z } from "zod";

// Define your table
const table = defineTable({
  name: "my-app-table",
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
    gsi1: { hashKey: "type", rangeKey: "createdAt" },
  },
});

// Define an entity with a Zod schema
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

// Create a user
const user = await users.put({
  id: "123",
  email: "alice@example.com",
  name: "Alice",
});

// Query users
const recentUsers = await users.queryAll({
  index: "gsi1",
  type: "user",
  createdAt: { beginsWith: "2024" },
});
```

## Next Steps

- [Quick Start](/quick-start) - Get up and running in 5 minutes
- [Tables](/tables) - Learn about table configuration
- [Entities](/entities) - Define your data models
- [Querying](/querying) - Master DynamoDB queries

_LLMs: [go here](/llms.txt) to find the full documentation as a text file._
