import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuid } from "uuid";
import { describe, it, expect } from "vitest";

import { counter, table } from "./schema";

const getRaw = (pk: string, sk: string) =>
  table.client.send(
    new GetCommand({
      TableName: process.env.TURBINE_TEST_TABLE!,
      Key: { pk, sk },
    }),
  );

describe("integration: update expressions", () => {
  it("increment and decrement", async () => {
    const id = uuid();
    await counter.put({ id, count: 10, tags: [] });

    await counter.update(
      { pk: ["counter", id], sk: id },
      { count: { increment: 3 } },
    );

    const after1 = await counter.get({ pk: ["counter", id], sk: id });
    expect(after1!.count).toBe(13);

    await counter.update(
      { pk: ["counter", id], sk: id },
      { count: { decrement: 5 } },
    );

    const after2 = await counter.get({ pk: ["counter", id], sk: id });
    expect(after2!.count).toBe(8);
  });

  it("append and prepend", async () => {
    const id = uuid();
    await counter.put({ id, count: 0, tags: ["initial"] });

    await counter.update(
      { pk: ["counter", id], sk: id },
      { tags: { append: ["appended"] } },
    );

    const after1 = await counter.get({ pk: ["counter", id], sk: id });
    expect(after1!.tags).toEqual(["initial", "appended"]);

    await counter.update(
      { pk: ["counter", id], sk: id },
      { tags: { prepend: ["first"] } },
    );

    const after2 = await counter.get({ pk: ["counter", id], sk: id });
    expect(after2!.tags).toEqual(["first", "initial", "appended"]);
  });

  it("ifNotExists — sets only when attribute is missing", async () => {
    const id = uuid();
    await counter.put({ id, count: 0, tags: [] });

    // bio is not set, so ifNotExists should write it
    await counter.update(
      { pk: ["counter", id], sk: id },
      { bio: { ifNotExists: "default bio" } },
    );

    const after1 = await counter.get({ pk: ["counter", id], sk: id });
    expect(after1!.bio).toBe("default bio");

    // bio already exists, should NOT overwrite
    await counter.update(
      { pk: ["counter", id], sk: id },
      { bio: { ifNotExists: "overwritten" } },
    );

    const after2 = await counter.get({ pk: ["counter", id], sk: id });
    expect(after2!.bio).toBe("default bio");
  });

  it("remove — deletes an attribute", async () => {
    const id = uuid();
    await counter.put({ id, count: 0, tags: [] });
    await counter.update(
      { pk: ["counter", id], sk: id },
      { bio: "will be removed" },
    );

    await counter.update(
      { pk: ["counter", id], sk: id },
      { bio: { remove: true } },
    );

    const raw = await getRaw(`counter#${id}`, id);
    expect(raw.Item!.bio).toBeUndefined();
  });

  it("addToSet and deleteFromSet", async () => {
    const id = uuid();
    await counter.put({ id, count: 0, tags: [] });

    // Use raw DynamoDB sets via addToSet
    await counter.update(
      { pk: ["counter", id], sk: id },
      { roles: { addToSet: new Set(["admin", "editor"]) } },
    );

    const raw1 = await getRaw(`counter#${id}`, id);
    expect(new Set(raw1.Item!.roles)).toEqual(new Set(["admin", "editor"]));

    await counter.update(
      { pk: ["counter", id], sk: id },
      { roles: { deleteFromSet: new Set(["editor"]) } },
    );

    const raw2 = await getRaw(`counter#${id}`, id);
    expect(new Set(raw2.Item!.roles)).toEqual(new Set(["admin"]));
  });

  it("increment on a nested field via dot-notation", async () => {
    const id = uuid();
    await counter.put({ id, count: 0, tags: [], stats: { views: 10 } });

    await counter.update(
      { pk: ["counter", id], sk: id },
      { "stats.views": { increment: 5 } },
    );

    const raw = await getRaw(`counter#${id}`, id);
    expect(raw?.Item?.stats?.views).toBe(15);
  });

  it("mixed expressions in a single update", async () => {
    const id = uuid();
    await counter.put({ id, count: 5, tags: ["a"], bio: "hello" });

    await counter.update(
      { pk: ["counter", id], sk: id },
      {
        count: { increment: 2 },
        tags: { append: ["b"] },
        bio: { remove: true },
      },
    );

    const after = await counter.get({ pk: ["counter", id], sk: id });
    expect(after!.count).toBe(7);
    expect(after!.tags).toEqual(["a", "b"]);

    const raw = await getRaw(`counter#${id}`, id);
    expect(raw.Item!.bio).toBeUndefined();
  });

  it("plain value set combined with increment on another field", async () => {
    const id = uuid();
    await counter.put({ id, count: 3, tags: [], bio: "old" });

    await counter.update(
      { pk: ["counter", id], sk: id },
      { bio: "updated", count: { increment: 10 } },
    );

    const after = await counter.get({ pk: ["counter", id], sk: id });
    expect(after!.bio).toBe("updated");
    expect(after!.count).toBe(13);
  });
});
