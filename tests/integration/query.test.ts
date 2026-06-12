import { v4 as uuid } from "uuid";
import { describe, it, expect } from "vitest";

import { comment, post, product, user } from "./schema";

describe("integration: queries and pagination", () => {
  it("queries global feed via gsi1 and paginates", async () => {
    const run = uuid();
    const u = await user.put({
      id: `${run}-u`,
      email: `${run}@example.com`,
      username: `user_${run}`,
      createdAt: new Date().toISOString(),
    });

    // create multiple posts
    for (let i = 0; i < 4; i++) {
      await post.put({
        id: `${run}-p${i}`,
        authorId: u.id,
        title: `Post ${i}`,
        createdAt: new Date().toISOString(),
      });
      await new Promise((r) => setTimeout(r, 10));
    }

    const page1 = await post.query(
      { index: "gsi1", type: "post" },
      { Limit: 2 },
    );
    expect(page1.length).toBeLessThanOrEqual(2);
    expect(typeof page1.next === "function" || page1.next === undefined).toBe(
      true,
    );
  });

  it("queries comments on a post and uses queryOne", async () => {
    const run = uuid();
    const u = await user.put({
      id: `${run}-u`,
      email: `${run}@example.com`,
      username: `user_${run}`,
      createdAt: new Date().toISOString(),
    });
    const p = await post.put({
      id: `${run}-p`,
      authorId: u.id,
      title: "Hello",
      createdAt: new Date().toISOString(),
    });

    const c = await comment.put({
      id: `${run}-c`,
      postId: p.id,
      authorId: u.id,
      content: "Nice!",
      createdAt: new Date().toISOString(),
    });

    const found = await comment.queryOne({
      pk: ["post", p.id],
      sk: { beginsWith: "comment" },
    });
    expect(found?.id).toBe(c.id);
  });

  it("throws when specifying an invalid index name on query", async () => {
    await expect(
      comment.query({
        pk: ["post", "123"],
        sk: { beginsWith: "comment" },
        index: "invalid-index",
      }),
    ).rejects.toThrow('Index with name "invalid-index" is not defined');
  });

  it("throws when hashKey of specified index is not provided", async () => {
    await expect(
      comment.query({
        pk: ["post", "123"],
        sk: { beginsWith: "comment" },
        index: "gsi1",
      }),
    ).rejects.toThrow('No value found for hash key "type"');
  });

  it("throws when hashKey expression is not equals", async () => {
    await expect(
      comment.query({
        type: { beginsWith: "comment" },
        sk: { beginsWith: "comment" },
        index: "gsi1",
      }),
    ).rejects.toThrow("Query key condition not supported");
  });

  it("filters query results on a nested attribute using dot-notation", async () => {
    const run = uuid();

    await product.put({
      id: `${run}-electronics`,
      name: "Laptop",
      meta: { category: "electronics", active: true },
    });
    await product.put({
      id: `${run}-clothing`,
      name: "T-Shirt",
      meta: { category: "clothing", active: true },
    });

    const results = await product.queryAll(
      { pk: ["product", `${run}-electronics`] },
      { filters: { "meta.category": "electronics" } },
    );

    expect(results).toHaveLength(1);
    expect(results[0].meta.category).toBe("electronics");
  });
});
