import { describe, it, expect, vi, beforeEach } from "vitest";
import z from "zod";

import { captureDynamoDBCommand } from "./generation-test-utils";
import { defineEntity, defineTable } from "../../src";

const emptyResult = { Items: [] };

const table = defineTable({
  name: "test-table",
  indexes: {
    table: { hashKey: "pk", rangeKey: "sk" },
    gsi_type: { hashKey: "type", rangeKey: "sk" },
  },
});

const post = defineEntity({
  table,
  schema: z.object({
    id: z.string(),
    title: z.string(),
    status: z.string().optional(),
    score: z.number().optional(),
    tags: z.array(z.string()).optional(),
    object: z.object({
      nested1: z.string(),
    }),
  }),
  keys: {
    type: () => "post",
    pk: (p) => ["post", p.id],
    sk: (p) => p.id,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("query-generation", () => {
  it("query hash key", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () => post.query({ pk: ["post", "123"] }),
      emptyResult,
    );

    expect(input).toMatchSnapshot();
  });

  it("query hash and range key", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () => post.query({ pk: ["post", "123"], sk: "123" }),
      emptyResult,
    );

    expect(input).toMatchSnapshot();
  });

  it("query range key beginsWith", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () => post.query({ pk: ["post", "123"], sk: { beginsWith: "post#" } }),
      emptyResult,
    );

    expect(input).toMatchSnapshot();
  });

  it("query range key greaterThan", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () => post.query({ pk: ["post", "123"], sk: { greaterThan: "a" } }),
      emptyResult,
    );

    expect(input).toMatchSnapshot();
  });

  it("query range key lessThan", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () => post.query({ pk: ["post", "123"], sk: { lessThan: "z" } }),
      emptyResult,
    );

    expect(input).toMatchSnapshot();
  });

  it("query range key between", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () => post.query({ pk: ["post", "123"], sk: { between: ["a", "z"] } }),
      emptyResult,
    );

    expect(input).toMatchSnapshot();
  });

  it("query filter equals", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          { filters: { status: { equals: "published" } } },
        ),
      emptyResult,
    );

    expect(input).toMatchSnapshot();
  });

  it("query nested filter equals", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          { filters: { "object.nested1": { equals: "nested2" } } },
        ),
      emptyResult,
    );

    expect(input).toMatchSnapshot();
  });

  it("query filter notEquals", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          { filters: { status: { notEquals: "draft" } } },
        ),
      emptyResult,
    );
    expect(input).toMatchSnapshot();
  });

  it("query filter greaterThan", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          { filters: { score: { greaterThan: 5 } } },
        ),
      emptyResult,
    );
    expect(input).toMatchSnapshot();
  });

  it("query filter lessThanOrEquals", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          { filters: { score: { lessThanOrEquals: 10 } } },
        ),
      emptyResult,
    );
    expect(input).toMatchSnapshot();
  });

  it("query filter between", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          { filters: { score: { between: [1, 10] } } },
        ),
      emptyResult,
    );
    expect(input).toMatchSnapshot();
  });

  it("query filter contains", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          { filters: { title: { contains: "hello" } } },
        ),
      emptyResult,
    );
    expect(input).toMatchSnapshot();
  });

  it("query filter notContains", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          { filters: { title: { notContains: "spam" } } },
        ),
      emptyResult,
    );
    expect(input).toMatchSnapshot();
  });

  it("query filter beginsWith", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          { filters: { title: { beginsWith: "Hello" } } },
        ),
      emptyResult,
    );
    expect(input).toMatchSnapshot();
  });

  it("query filter exists", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          { filters: { status: { exists: true } } },
        ),
      emptyResult,
    );
    expect(input).toMatchSnapshot();
  });

  it("query filter notExists", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          { filters: { status: { notExists: true } } },
        ),
      emptyResult,
    );
    expect(input).toMatchSnapshot();
  });

  it("query multiple filters", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          {
            filters: {
              status: { equals: "published" },
              score: { greaterThan: 5 },
            },
          },
        ),
      emptyResult,
    );
    expect(input).toMatchSnapshot();
  });

  it("query filter with GSI", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query({
          index: "gsi_type",
          type: "post",
          sk: { beginsWith: "post#" },
        }),
      emptyResult,
    );
    expect(input).toMatchSnapshot();
  });

  it("query with options", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          { Limit: 10, ScanIndexForward: false },
        ),
      emptyResult,
    );
    expect(input).toMatchSnapshot();
  });

  it("query filter or", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          {
            filters: {
              or: [{ status: "published" }, { status: "draft" }],
            },
          },
        ),
      emptyResult,
    );
    expect(input).toMatchSnapshot();
  });

  it("query filter or of and blocks", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          {
            filters: {
              or: [
                {
                  and: [{ status: "published" }, { score: { greaterThan: 5 } }],
                },
                { and: [{ status: "draft" }, { score: { lessThan: 2 } }] },
              ],
            },
          },
        ),
      emptyResult,
    );
    expect(input).toMatchSnapshot();
  });

  it("query filter and with nested or", async () => {
    const input = await captureDynamoDBCommand(
      table,
      () =>
        post.query(
          { pk: ["post", "123"] },
          {
            filters: {
              and: [
                { title: { exists: true } },
                { or: [{ status: "published" }, { status: "draft" }] },
              ],
            },
          },
        ),
      emptyResult,
    );
    expect(input).toMatchSnapshot();
  });
});
