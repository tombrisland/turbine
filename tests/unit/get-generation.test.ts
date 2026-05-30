import { GetCommandInput } from "@aws-sdk/lib-dynamodb";
import { describe, it, expect, vi, beforeEach } from "vitest";
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
  }),
  keys: {
    pk: (u) => ["user", u.id],
    sk: (u) => u.email,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("get-generation", () => {
  it("get by primary key", async () => {
    const input = await captureDynamoDBCommand(table, () =>
      user.get({ pk: ["user", "123"], sk: "user@example.com" }),
    );

    expect(input).toMatchSnapshot();
  });

  it("get key array joined with #", async () => {
    const input: GetCommandInput = await captureDynamoDBCommand(table, () =>
      user.get({ pk: ["user", "abc-def"], sk: "test@example.com" }),
    );

    expect(input?.Key?.pk).toBe("user#abc-def");
    expect(input).toMatchSnapshot();
  });

  it("get with ConsistentRead", async () => {
    const input: GetCommandInput = await captureDynamoDBCommand(table, () =>
      user.get(
        { pk: ["user", "123"], sk: "user@example.com" },
        { ConsistentRead: true },
      ),
    );

    expect(input.ConsistentRead).toBeTruthy();
    expect(input).toMatchSnapshot();
  });

  it("get with ProjectionExpression", async () => {
    const input = await captureDynamoDBCommand(table, () =>
      user.get(
        { pk: ["user", "123"], sk: "user@example.com" },
        { ProjectionExpression: "id, email" },
      ),
    );

    expect(input).toMatchSnapshot();
  });
});
