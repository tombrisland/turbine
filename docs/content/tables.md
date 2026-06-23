+++
title = "Tables"
+++

The `defineTable` function creates a table configuration that entities use to interact with DynamoDB.

## Basic Usage

```typescript
import { defineTable } from "dynamodb-turbine";

const table = defineTable({
  name: "my-dynamodb-table",
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
  },
});
```

## Table Definition

The `defineTable` function accepts a configuration object:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | The DynamoDB table name |
| `indexes` | `object` | Yes | Index definitions |
| `documentClient` | `DynamoDBDocumentClient` | No | Custom AWS SDK client |

## Indexes

The `indexes` object defines your table's primary key and any Global Secondary Indexes (GSIs).

### Primary Index

The `table` key defines your primary key:

```typescript
indexes: {
  table: { hashKey: "pk", rangeKey: "sk" },
}
```

- `hashKey` (required) - The partition key attribute name
- `rangeKey` (optional) - The sort key attribute name

### Global Secondary Indexes

Additional keys define GSIs:

```typescript
indexes: {
  table: { hashKey: "pk", rangeKey: "sk" },
  gsi1: { hashKey: "type", rangeKey: "createdAt" },
  gsi2: { hashKey: "email" },
  gsi3: { hashKey: "status", rangeKey: "updatedAt" },
}
```

> The index names (`gsi1`, `gsi2`, etc.) must match the index names in your DynamoDB table.

## Custom DynamoDB Client

By default, Turbine creates a DynamoDB Document Client with sensible defaults:

```typescript
// Default client configuration
{
  convertEmptyValues: true,
  removeUndefinedValues: true,
}
```

To use a custom client:

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const dynamoClient = new DynamoDBClient({
  region: "us-east-1",
  endpoint: "http://localhost:8000", // Local DynamoDB
});

const documentClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
  },
});

const table = defineTable({
  name: "my-table",
  documentClient,
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
  },
});
```

## Table Properties

The returned table object has the following properties:

```typescript
const table = defineTable({ /* ... */ });

table.definition  // The original table definition
table.client      // The DynamoDBDocumentClient instance
```

## Common Patterns

### Single-Table Design

For single-table design, define all your GSIs upfront:

```typescript
const table = defineTable({
  name: "app-data",
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
    gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
    gsi2: { hashKey: "gsi2pk", rangeKey: "gsi2sk" },
    gsi3: { hashKey: "type", rangeKey: "createdAt" },
  },
});
```

### Environment-Based Table Names

```typescript
const table = defineTable({
  name: process.env.DYNAMODB_TABLE_NAME!,
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
  },
});
```

### Multiple Tables

You can define multiple tables in your application:

```typescript
const usersTable = defineTable({
  name: "users",
  indexes: {
    table: { hashKey: "userId" },
    byEmail: { hashKey: "email" },
  },
});

const ordersTable = defineTable({
  name: "orders",
  indexes: {
    table: { hashKey: "orderId" },
    byUser: { hashKey: "userId", rangeKey: "createdAt" },
  },
});
```

## Next Steps

- [Entities](/entities) - Define data models using your table
- [Computed Field Patterns](/key-patterns) - Learn about key design strategies
