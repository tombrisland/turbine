import { describe, it, expect } from "vitest";
import z from "zod";

import { defineEntity, defineTable } from "../../src";
import { parseInstance, parsePagedResult } from "../../src/parsing";

const table = defineTable({
  name: "test",
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
    gsi1: { hashKey: "type", rangeKey: "sk" },
  },
});

const user = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    email: z.email(),
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

describe("parsing: instance", () => {
  it("parses instance from data", async () => {
    const raw = {
      pk: "user#123",
      sk: "user@example.com",
      type: "user",
      id: "123",
      email: "user@example.com",
      unknownKey: "hi from alien",
    };

    expect(await parseInstance(user.definition, user as any, raw)).toEqual({
      id: "123",
      email: "user@example.com",
      pk: "user#123",
      sk: "user@example.com",
      type: "user",
      update: expect.any(Function),
    });
  });

  it("parses a paged result", async () => {
    const raw = {
      Items: [
        {
          pk: "user#123",
          sk: "user@example.com",
          type: "user",
          id: "123",
          email: "user@example.com",
        },
      ],
      LastEvaluatedKey: {
        pk: "user#123",
        sk: "user@example.com",
      },
    };

    const page = await parsePagedResult(
      user.definition,
      user as any,
      raw.Items,
      raw.LastEvaluatedKey,
      (() => {}) as any,
    );
    expect(page.length).toBe(1);
    expect(page[0]).toEqual({
      id: "123",
      email: "user@example.com",
      pk: "user#123",
      sk: "user@example.com",
      type: "user",
      update: expect.any(Function),
    });

    expect(page.lastEvaluatedKey).toEqual({
      pk: "user#123",
      sk: "user@example.com",
    });
    expect(page.next).toBeDefined();
  });
});
