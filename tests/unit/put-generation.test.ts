import type { PutCommandInput } from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import z from "zod";

import { captureDynamoDBCommand } from "./generation-test-utils";
import { defineEntity, defineTable } from "../../src";

const table = defineTable({
  name: "test-table",
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
  },
});

const user = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    email: z.email(),
    name: z.string().optional(),
    role: z.enum(["admin", "user"]).default("user"),
    type: z.string(),
    pk: z.string(),
    sk: z.string(),
  }),
  computed: {
    type: () => "user",
    pk: (u) => ["user", u.id],
    sk: (u) => u.email,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("put-generation", () => {
  it("basic put with only required fields", async () => {
    const input: PutCommandInput = await captureDynamoDBCommand(table, () =>
      user.put({ id: "123", email: "user@example.com" }),
    );

    // Role should default to "user"
    expect(input?.Item?.role).toBe("user");
    // Type should also default to user
    expect(input?.Item?.type).toBe("user");
    expect(input).toMatchSnapshot();
  });

  it("put with optional fields", async () => {
    const input = await captureDynamoDBCommand(table, () =>
      user.put({ id: "123", email: "user@example.com", name: "Alice" }),
    );

    expect(input).toMatchSnapshot();
  });

  it("put derives keys from data", async () => {
    const input: PutCommandInput = await captureDynamoDBCommand(table, () =>
      user.put({ id: "abc-123", email: "alice@example.com" }),
    );

    expect(input?.Item?.pk).toBe("user#abc-123");
    expect(input?.Item?.sk).toBe("alice@example.com");
    expect(input?.Item?.type).toBe("user");
    expect(input).toMatchSnapshot();
  });

  it("put with condition expression", async () => {
    const input: PutCommandInput = await captureDynamoDBCommand(table, () =>
      user.put(
        { id: "123", email: "user@example.com" },
        { conditions: { email: { notExists: true } } },
      ),
    );

    expect(input.ConditionExpression).toBe(
      "attribute_not_exists(#condition_email)",
    );
    expect(input).toMatchSnapshot();
  });

  it("put with multiple conditions", async () => {
    const input: PutCommandInput = await captureDynamoDBCommand(table, () =>
      user.put(
        { id: "123", email: "user@example.com" },
        {
          conditions: { email: { notExists: true }, role: { equals: "user" } },
        },
      ),
    );

    expect(input.ConditionExpression).toContain("attribute_not_exists");
    expect(input.ConditionExpression).toContain("=");
    expect(input).toMatchSnapshot();
  });

  it("put strips unknown field", async () => {
    const input: PutCommandInput = await captureDynamoDBCommand(table, () =>
      // @ts-expect-error unknown field
      user.put({ id: "123", email: "user@example.com", unknownField: "oops" }),
    );

    expect(input.Item).not.toHaveProperty("unknownField");
    expect(input).toMatchSnapshot();
  });
});
