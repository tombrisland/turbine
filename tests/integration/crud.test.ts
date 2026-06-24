import { v4 as uuid } from "uuid";
import { describe, it, expect } from "vitest";

import { like, post, user } from "./schema";

const runId = uuid();

describe("integration: CRUD", () => {
  let uId: string = uuid();
  let pId: string = uuid();

  it("creates and gets a user", async () => {
    uId = `${runId}-u1`;
    const created = await user.put({
      id: uId,
      email: `${uId}@example.com`,
      username: `user_${uId}`,
      createdAt: new Date().toISOString(),
    });

    expect(created.id).toBe(uId);

    const fetched = await user.get({
      pk: ["user", uId],
      sk: ["user", `${uId}@example.com`],
    });
    expect(fetched?.username).toBe(`user_${uId}`);
  });

  it("updates an entity (user)", async () => {
    const updated = await user.update(
      { pk: ["user", uId], sk: ["user", `${uId}@example.com`] },
      { username: `updated_${uId}` },
    );
    expect(updated.username).toBe(`updated_${uId}`);
  });

  it("creates a post and queries it by id (gsi3)", async () => {
    pId = `${runId}-p1`;
    const created = await post.put({
      id: pId,
      authorId: uId,
      title: `Hello ${pId}`,
      createdAt: new Date().toISOString(),
    });
    expect(created.id).toBe(pId);

    // Query post by id using the id-based index
    const found = await post.queryOne({
      index: "gsi3",
      gsi2pk: "post#id",
      gsi2sk: pId,
    });
    expect(found?.id).toBe(pId);
  });

  it("likes a post and can find it among likes", async () => {
    const l1 = await like.put({
      userId: uId,
      postId: pId,
      createdAt: new Date().toISOString(),
    });
    expect(l1.postId).toBe(pId);

    const likes = await like.queryAll({
      index: "gsi1",
      type: "like",
    });
    expect(likes.some((x) => x.userId === uId && x.postId === pId)).toBe(true);
  });

  it("deletes a user item", async () => {
    await user.delete({
      pk: ["user", uId],
      sk: ["user", `${uId}@example.com`],
    });

    const fetched = await user.get({
      pk: ["user", uId],
      sk: ["user", `${uId}@example.com`],
    });
    expect(fetched).toBeNull();
  });

  it("rejects a conditional put when the item already exists", async () => {
    const id = `${runId}-cond`;
    await user.put({
      id,
      email: `${id}@example.com`,
      username: `user_${id}`,
      createdAt: new Date().toISOString(),
    });

    await expect(
      user.put(
        {
          id,
          email: `${id}@example.com`,
          username: `user_${id}`,
          createdAt: new Date().toISOString(),
        },
        { conditions: { id: { notExists: true } } },
      ),
    ).rejects.toThrow();
  });
});
