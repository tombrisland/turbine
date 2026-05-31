import { describe, it, expect, vi, beforeEach } from "vitest";
import z from "zod";

import { captureDynamoDBCommand } from "./generation-test-utils";
import { defineEntity, defineTable } from "../../src";
import type { UpdateCommandInput } from "@aws-sdk/lib-dynamodb";

const table = defineTable({
  name: "test-table",
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
  },
});

const defaultCreatedAt = new Date("2012-02-18");
const defaultUser = {
  id: "123",
  email: "tom@domain.uk",
};

const user = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    email: z.email(),
    name: z.string().optional().nullable(),
    age: z.number().optional(),
    bio: z.string().optional(),
    createdAt: z.iso.datetime({ local: true }).optional(),
  }),
  keys: {
    pk: (u) => ["user", u.id],
    sk: (u) => u.email,
    createdAt: (u) => u.createdAt ?? defaultCreatedAt.toISOString(),
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("update-generation", () => {
  it("update a single field", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        user.update(
          { pk: ["user", "123"], sk: "user@example.com" },
          { name: "Alice" },
        ),
      { Attributes: defaultUser },
    );

    expect(input).toMatchSnapshot();
  });

  it("update multiple fields", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        user.update(
          { pk: ["user", "123"], sk: "user@example.com" },
          { name: "Alice", age: 30 },
        ),
      { Attributes: defaultUser },
    );

    expect(input).toMatchSnapshot();
  });

  it("update removes field by setting null", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        user.update(
          { pk: ["user", "123"], sk: "user@example.com" },
          { name: null, age: 10 },
        ),
      { Attributes: defaultUser },
    );

    expect(input).toMatchSnapshot();
  });

  it("update with condition expression", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        user.update(
          { pk: ["user", "123"], sk: "user@example.com" },
          { name: "Alice" },
          { conditions: { name: { exists: true } } },
        ),
      { Attributes: defaultUser },
    );

    expect(input).toMatchSnapshot();
  });

  it("update merges condition and update ExpressionAttributeNames", async () => {
    const input: UpdateCommandInput = await captureDynamoDBCommand(
      table,
      () =>
        user.update(
          { pk: ["user", "123"], sk: "user@example.com" },
          { name: "Alice" },
          { conditions: { age: { greaterThan: 18 } } },
        ),
      { Attributes: defaultUser },
    );

    expect(input.ExpressionAttributeNames).toHaveProperty("#name");
    expect(input.ExpressionAttributeNames).toHaveProperty("#condition_age");
    expect(input.ConditionExpression).toBe("#condition_age > :condition_age");
    expect(input).toMatchSnapshot();
  });

  it("update protects createdAt by default", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        user.update(
          { pk: ["user", "123"], sk: "user@example.com" },
          { createdAt: "2024-01-01T00:00:00.000Z" },
        ),
      { Attributes: defaultUser },
    );

    expect(input).toMatchSnapshot();
  });

  it("update with array key joined", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        user.update(
          { pk: ["user", "abc-def"], sk: "test@example.com" },
          { name: "Charlie" },
        ),
      { Attributes: defaultUser },
    );

    expect(input).toMatchSnapshot();
  });
});
