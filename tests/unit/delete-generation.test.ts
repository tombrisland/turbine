import type { DeleteCommandInput } from "@aws-sdk/lib-dynamodb";
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
  }),
  keys: {
    pk: (u) => ["user", u.id],
    sk: (u) => u.email,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("delete-generation", () => {
  it("delete by primary key", async () => {
    const input: DeleteCommandInput = await captureDynamoDBCommand(table, () =>
      user.delete({ pk: ["user", "123"], sk: "user@example.com" }),
    );

    expect(input.TableName).toBe("test-table");
    expect(input).toMatchSnapshot();
  });

  it("key arrays are joined with #", async () => {
    const input: DeleteCommandInput = await captureDynamoDBCommand(table, () =>
      user.delete({ pk: ["user", "abc-def"], sk: "test@example.com" }),
    );

    expect(input?.Key?.pk).toBe("user#abc-def");
    expect(input).toMatchSnapshot();
  });

  it("delete with exists condition", async () => {
    const input: DeleteCommandInput = await captureDynamoDBCommand(table, () =>
      user.delete(
        { pk: ["user", "123"], sk: "user@example.com" },
        { conditions: { email: { exists: true } } },
      ),
    );

    expect(input.ConditionExpression).toBe(
      "attribute_exists(#condition_email)",
    );
    expect(input).toMatchSnapshot();
  });

  it("delete with equals condition", async () => {
    const input: DeleteCommandInput = await captureDynamoDBCommand(table, () =>
      user.delete(
        { pk: ["user", "123"], sk: "user@example.com" },
        { conditions: { email: { equals: "user@example.com" } } },
      ),
    );

    expect(input.ConditionExpression).toBe(
      "#condition_email = :condition_email",
    );
    expect(input.ExpressionAttributeValues).toMatchObject({
      ":condition_email": "user@example.com",
    });
    expect(input).toMatchSnapshot();
  });
});
