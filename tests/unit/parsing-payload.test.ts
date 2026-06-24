import { describe, it, expect } from "vitest";
import z from "zod";

import { defineEntity, defineTable } from "../../src";
import { expandPartialPayload, expandPayload } from "../../src/parsing";

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
    pk: (user) => ["user", user.id],
    sk: (user) => user.email,
  },
});

const post = defineEntity({
  table,
  schema: z.object({
    id: z
      .string()
      .optional()
      .default(() => "random"),
    title: z.string(),
    sk: z.string(),
    pk: z.string(),
  }),
  computed: {
    sk: () => "post",
    pk: (post) => ["post", post.id],
  },
});

describe("parsing: payload", () => {
  it("expands payload", async () => {
    const putPayload = {
      id: "123",
      email: "user@example.com",
      unknownKey: "hi from alien",
    };

    expect(await expandPayload(user.definition, putPayload)).toEqual({
      pk: "user#123",
      sk: "user@example.com",
      type: "user",
      id: "123",
      email: "user@example.com",
    });
  });

  it("throws when required field is missing", async () => {
    const putPayload = {
      email: "user@example.com",
    };

    await expect(expandPayload(user.definition, putPayload)).rejects.toThrow();
  });

  it("applies defaults", async () => {
    const payload = {
      title: "Random post",
    };

    expect(await expandPayload(post.definition, payload)).toEqual({
      pk: "post#random",
      sk: "post",
      id: "random",
      title: "Random post",
    });
  });

  it("expands partial payload", async () => {
    const putPayload = {
      email: "user@example.com",
      unknownKey: "hi from alien",
    };

    expect(await expandPartialPayload(user.definition, putPayload)).toEqual({
      sk: "user@example.com",
      type: "user",
      email: "user@example.com",
    });
  });
});
