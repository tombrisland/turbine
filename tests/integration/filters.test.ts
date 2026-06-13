import { v4 as uuid } from "uuid";
import { describe, it, expect } from "vitest";

import { post } from "./schema";

describe("integration: filters", () => {
  it("filters out deleted posts", async () => {
    const runId = uuid();

    await post.put({
      id: `${runId}-p1`,
      authorId: runId,
      title: `Hello World!`,
      deletedAt: new Date().toISOString(),
    });
    await post.put({
      id: `${runId}-p2`,
      authorId: runId,
      title: `Hello Moon!`,
    });

    const results = await post.queryAll(
      { pk: ["user", runId] },
      {
        filters: {
          deletedAt: { notExists: true },
        },
      },
    );

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Hello Moon!");
  });

  it("filters posts by title", async () => {
    const runId = uuid();

    await post.put({
      id: `${runId}-p3`,
      authorId: runId,
      title: `Hello World!`,
    });
    await post.put({
      id: `${runId}-p4`,
      authorId: runId,
      title: `Goodbye World!`,
    });

    const results = await post.queryAll(
      { pk: ["user", runId] },
      {
        filters: {
          title: {
            beginsWith: "Hello",
          },
        },
      },
    );

    expect(results).toHaveLength(1);
    expect(results[0].id).toContain("-p3");
  });

  it("filters with OR — returns posts matching either condition", async () => {
    const runId = uuid();

    await post.put({
      id: `${runId}-published`,
      authorId: runId,
      title: "Published post",
    });
    await post.put({
      id: `${runId}-draft`,
      authorId: runId,
      title: "Draft post",
      deletedAt: new Date().toISOString(),
    });
    await post.put({
      id: `${runId}-other`,
      authorId: runId,
      title: "Other post",
      deletedAt: new Date().toISOString(),
    });

    const results = await post.queryAll(
      { pk: ["user", runId] },
      {
        filters: {
          or: [
            { deletedAt: { notExists: true } },
            { title: { beginsWith: "Draft" } },
          ],
        },
      },
    );

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id).sort()).toEqual(
      [`${runId}-draft`, `${runId}-published`].sort(),
    );
  });

  it("filters with OR of AND blocks — complex compound filter", async () => {
    const runId = uuid();

    // Should match: published AND title starts with "Hello"
    await post.put({ id: `${runId}-a`, authorId: runId, title: "Hello World" });
    // Should match: deleted AND title starts with "Goodbye"
    await post.put({
      id: `${runId}-b`,
      authorId: runId,
      title: "Goodbye World",
      deletedAt: new Date().toISOString(),
    });
    // Should NOT match: published but wrong title
    await post.put({
      id: `${runId}-c`,
      authorId: runId,
      title: "Something else",
    });
    // Should NOT match: deleted but wrong title
    await post.put({
      id: `${runId}-d`,
      authorId: runId,
      title: "Hello Again",
      deletedAt: new Date().toISOString(),
    });

    const results = await post.queryAll(
      { pk: ["user", runId] },
      {
        filters: {
          or: [
            {
              and: [
                { deletedAt: { notExists: true } },
                { title: { beginsWith: "Hello" } },
              ],
            },
            {
              and: [
                { deletedAt: { exists: true } },
                { title: { beginsWith: "Goodbye" } },
              ],
            },
          ],
        },
      },
    );

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id).sort()).toEqual(
      [`${runId}-a`, `${runId}-b`].sort(),
    );
  });
});

describe("integration: condition expressions", () => {
  it("conditional update with OR — succeeds when either condition is met", async () => {
    const runId = uuid();
    await post.put({
      id: `${runId}-p`,
      authorId: runId,
      title: "Original",
    });

    // Condition: title equals "Original" OR deletedAt does not exist — both true, should succeed
    await expect(
      post.update(
        { pk: ["user", runId], sk: `${runId}-p` },
        { title: "Updated" },
        {
          conditions: {
            or: [
              { title: { equals: "Original" } },
              { deletedAt: { notExists: true } },
            ],
          },
        },
      ),
    ).resolves.toMatchObject({ title: "Updated" });
  });

  it("conditional update with AND — fails when one condition is not met", async () => {
    const runId = uuid();
    await post.put({ id: `${runId}-p`, authorId: runId, title: "Original" });

    // Condition: title equals "Original" AND deletedAt exists — deletedAt doesn't exist, should fail
    await expect(
      post.update(
        { pk: ["user", runId], sk: `${runId}-p` },
        { title: "Updated" },
        {
          conditions: {
            and: [
              { title: { equals: "Original" } },
              { deletedAt: { exists: true } },
            ],
          },
        },
      ),
    ).rejects.toThrow();
  });
});
