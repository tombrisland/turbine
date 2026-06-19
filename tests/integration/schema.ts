import z from "zod";

import { defineEntity, defineTable } from "../../src";

const tableName = process.env.TURBINE_TEST_TABLE as string;

export const table = defineTable({
  name: tableName,
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
    gsi1: { hashKey: "type", rangeKey: "sk" },
    gsi2: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
    gsi3: { hashKey: "gsi2pk", rangeKey: "gsi2sk" },
  },
});

export const user = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    email: z.email(),
    username: z.string(),
    createdAt: z.iso.datetime().default(() => new Date().toISOString()),
    type: z.string(),
    pk: z.string(),
    sk: z.string(),
    gsi1pk: z.string(),
    gsi1sk: z.string(),
  }),
  computed: {
    type: () => "user",
    pk: (u) => ["user", u.id],
    sk: (u) => ["user", u.email],
    gsi1pk: () => "user#username",
    gsi1sk: (u) => u.username,
  },
});

export const post = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    authorId: z.string(),
    title: z.string(),
    deletedAt: z.iso.datetime().optional(),
    createdAt: z.iso.datetime().default(() => new Date().toISOString()),
    type: z.string(),
    pk: z.string(),
    sk: z.string(),
    gsi1pk: z.string(),
    gsi1sk: z.string(),
    gsi2pk: z.string(),
    gsi2sk: z.string(),
  }),
  computed: {
    type: () => "post",
    pk: (p) => ["user", p.authorId],
    sk: (p) => p.id,
    gsi1pk: () => "post",
    gsi1sk: (p) => [p.createdAt, p.id],
    gsi2pk: () => "post#id",
    gsi2sk: (p) => p.id,
  },
});

export const comment = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    postId: z.string(),
    authorId: z.string(),
    content: z.string(),
    createdAt: z.iso.datetime().default(() => new Date().toISOString()),
    type: z.string(),
    pk: z.string(),
    sk: z.string(),
    gsi1pk: z.string(),
    gsi1sk: z.string(),
  }),
  computed: {
    type: () => "comment",
    pk: (c) => ["post", c.postId],
    sk: (c) => ["comment", c.createdAt, c.id],
    gsi1pk: () => "comment",
    gsi1sk: (c) => [c.createdAt, c.id],
  },
});

export const like = defineEntity({
  table,
  schema: z.object({
    userId: z.string(),
    postId: z.string(),
    createdAt: z.iso.datetime().default(() => new Date().toISOString()),
    type: z.string(),
    pk: z.string(),
    sk: z.string(),
    gsi1pk: z.string(),
    gsi1sk: z.string(),
  }),
  computed: {
    type: () => "like",
    pk: (l) => ["post", l.postId],
    sk: (l) => ["like", l.createdAt, l.userId],
    gsi1pk: (l) => ["user", l.userId],
    gsi1sk: (l) => ["like", l.createdAt, l.postId],
  },
});

export const product = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    name: z.string(),
    meta: z.object({ category: z.string(), active: z.boolean() }),
    createdAt: z.iso.datetime().default(() => new Date().toISOString()),
    type: z.string(),
    pk: z.string(),
    sk: z.string(),
  }),
  computed: {
    type: () => "product",
    pk: (p) => ["product", p.id],
    sk: (p) => p.id,
  },
});

export const counter = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    count: z.number().default(0),
    tags: z.array(z.string()).default([]),
    roles: z.any().optional(),
    bio: z.string().optional(),
    stats: z.object({ views: z.number() }).optional(),
    createdAt: z.iso.datetime().default(() => new Date().toISOString()),
    type: z.string(),
    pk: z.string(),
    sk: z.string(),
  }),
  computed: {
    type: () => "counter",
    pk: (c) => ["counter", c.id],
    sk: (c) => c.id,
  },
});

export type Entities = {
  user: typeof user;
  post: typeof post;
  comment: typeof comment;
  like: typeof like;
  product: typeof product;
  counter: typeof counter;
};
