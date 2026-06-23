import type {
  PutCommandInput,
  UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import z from "zod";

import { captureDynamoDBCommand } from "./generation-test-utils";
import { defineEntity, defineTable } from "../../src";

const table = defineTable({
  name: "test-table",
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
    type_sk: { hashKey: "type", rangeKey: "sk" },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("computed fields", () => {
  describe("with computed", () => {
    const user = defineEntity({
      table,
      schema: z.object({
        id: z.string(),
        email: z.email(),
        name: z.string().optional(),
        pk: z.string(),
        sk: z.string(),
        type: z.string(),
        createdAt: z.string().optional(),
      }),
      computed: {
        pk: (u) => ["user", u.id],
        sk: (u) => u.email,
        type: () => "user",
        createdAt: (u) => u.createdAt || "2024-01-01T00:00:00Z",
      },
    });

    it("put derives composite keys and defaults", async () => {
      const input: PutCommandInput = await captureDynamoDBCommand(table, () =>
        user.put({ id: "123", email: "alice@example.com" }),
      );

      expect(input.Item).toMatchObject({
        pk: "user#123",
        sk: "alice@example.com",
        type: "user",
        createdAt: "2024-01-01T00:00:00Z",
        id: "123",
        email: "alice@example.com",
      });
    });

    it("put allows overriding defaulted computed fields", async () => {
      const input: PutCommandInput = await captureDynamoDBCommand(table, () =>
        user.put({
          id: "123",
          email: "alice@example.com",
          createdAt: "2020-06-15T12:00:00Z",
        }),
      );

      expect(input.Item?.createdAt).toBe("2020-06-15T12:00:00Z");
    });

    it("put validates full schema including computed output", async () => {
      const strict = defineEntity({
        table,
        schema: z.object({
          id: z.string(),
          pk: z.string(),
          sk: z.string().email(),
        }),
        computed: {
          pk: (d) => d.id,
          sk: () => "not-an-email",
        },
      });

      await expect(strict.put({ id: "123" })).rejects.toThrow();
    });

    it("get returns full schema", async () => {
      vi.spyOn(table.client, "send").mockResolvedValue({
        Item: {
          pk: "user#123",
          sk: "alice@example.com",
          type: "user",
          id: "123",
          email: "alice@example.com",
          createdAt: "2024-01-01T00:00:00Z",
        },
      } as never);

      const result = await user.get({
        pk: ["user", "123"],
        sk: "alice@example.com",
      });

      expect(result).not.toBeNull();
      expect(result?.pk).toBe("user#123");
      expect(result?.sk).toBe("alice@example.com");
      expect(result?.type).toBe("user");
      expect(result?.id).toBe("123");
    });

    it("query returns full schema", async () => {
      vi.spyOn(table.client, "send").mockResolvedValue({
        Items: [
          {
            pk: "user#123",
            sk: "alice@example.com",
            type: "user",
            id: "123",
            email: "alice@example.com",
            createdAt: "2024-01-01T00:00:00Z",
          },
        ],
        LastEvaluatedKey: undefined,
      } as never);

      const results = await user.queryAll({ pk: ["user", "123"] });
      expect(results[0]?.pk).toBe("user#123");
      expect(results[0]?.type).toBe("user");
      expect(results[0]?.id).toBe("123");
    });

    it("update allows updating any field", async () => {
      const input: UpdateCommandInput = await captureDynamoDBCommand(
        table,
        () =>
          user.update(
            { pk: ["user", "123"], sk: "alice@example.com" },
            { name: "Alice", type: "admin" },
          ),
        {
          Attributes: {
            id: "123",
            email: "alice@example.com",
            pk: "user#123",
            sk: "alice@example.com",
            type: "user",
          },
        },
      );

      expect(input.ExpressionAttributeValues).toMatchObject({
        ":name": "Alice",
        ":type": "admin",
      });
    });
  });

  describe("with no computed fields", () => {
    const simple = defineEntity({
      table,
      schema: z.object({
        pk: z.string(),
        sk: z.string(),
        name: z.string(),
        age: z.number().optional(),
      }),
    });

    it("put stores schema fields directly", async () => {
      const input: PutCommandInput = await captureDynamoDBCommand(table, () =>
        simple.put({ pk: "pk1", sk: "sk1", name: "Bob" }),
      );

      expect(input.Item).toEqual({ pk: "pk1", sk: "sk1", name: "Bob" });
    });

    it("get returns schema fields", async () => {
      vi.spyOn(table.client, "send").mockResolvedValue({
        Item: { pk: "pk1", sk: "sk1", name: "Bob" },
      } as never);

      const result = await simple.get({ pk: "pk1", sk: "sk1" });
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Bob");
    });

    it("update works without computed fields", async () => {
      const input: UpdateCommandInput = await captureDynamoDBCommand(
        table,
        () => simple.update({ pk: "pk1", sk: "sk1" }, { name: "Charlie" }),
        { Attributes: { pk: "pk1", sk: "sk1", name: "Charlie" } },
      );

      expect(input.ExpressionAttributeValues).toMatchObject({
        ":name": "Charlie",
      });
    });
  });
});
