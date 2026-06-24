import { ReturnValue } from "@aws-sdk/client-dynamodb";
import { z } from "zod";

import {
  generateConditionExpression,
  generateQueryExpression,
  generateUpdateExpression,
} from "./expressions";
import {
  expandPayload,
  expandPartialPayload,
  parseInstance,
  parsePagedResult,
  resolveIndex,
  resolveKeyValues,
} from "./parsing";
import type { ComputedFieldDefinition } from "./types/computed";
import type { Entity, EntityDefinition } from "./types/entity";
import type { TableIndexDefinition } from "./types/table";

export const defineEntity = <
  S extends z.ZodObject,
  TI extends TableIndexDefinition,
  IX extends Record<string, TableIndexDefinition>,
  const D extends Record<string, ComputedFieldDefinition<z.infer<S>>>,
>(
  definition: EntityDefinition<S, TI, IX, D>,
): Entity<EntityDefinition<S, TI, IX, D>, IX> => {
  // @ts-expect-error missing
  const entity: Entity<EntityDefinition<S, TI, IX>, IX> = {
    definition,
  };

  entity.put = async (data, options) => {
    const payload = await expandPayload(definition, data);
    const condition = generateConditionExpression(options?.conditions);

    await definition.table.put({ Item: payload, ...condition });

    return parseInstance(definition, entity, payload);
  };

  entity.update = async (key, patch, options) => {
    const [, Key] = resolveIndex(definition, { ...key, index: "table" });
    const payload = await expandPartialPayload(definition, patch);

    for (const field of Object.keys(Key)) {
      if (field in payload) {
        delete payload[field];
      }
    }

    const update = generateUpdateExpression(payload, ["createdAt"]);
    const condition = generateConditionExpression(options?.conditions);

    const { Attributes } = await definition.table.update({
      Key: resolveKeyValues(Key),
      ...update,
      ...condition,
      ExpressionAttributeNames: {
        ...update.ExpressionAttributeNames,
        ...condition.ExpressionAttributeNames,
      },
      ExpressionAttributeValues: {
        ...update.ExpressionAttributeValues,
        ...condition.ExpressionAttributeValues,
      },
      ReturnValues: ReturnValue.ALL_NEW,
    });

    return parseInstance(definition, entity, Attributes);
  };

  entity.query = async (key, options) => {
    const [IndexName, Key] = resolveIndex(definition, key);

    const { filters, ...dynamoDbOptions } = options || {};
    const query = generateQueryExpression(Key, filters);

    const { Items, LastEvaluatedKey } = await definition.table.query({
      ...query,
      IndexName: IndexName === "table" ? undefined : IndexName,
      ...dynamoDbOptions,
    });

    const next = () =>
      entity.query(key, { ...options, ExclusiveStartKey: LastEvaluatedKey });

    return parsePagedResult(definition, entity, Items, LastEvaluatedKey, next);
  };

  entity.queryOne = (key, options) => {
    return entity
      .query(key, { Limit: 1, ...options })
      .then((result) => result[0] || null);
  };

  entity.queryAll = async (key, options) => {
    let next = () => entity.query(key, options);

    const items: any[] = [];
    while (next) {
      const result = await next();
      items.push(...result);
      if (!result.next) break;
      next = result.next;
    }

    return items;
  };

  entity.get = async (key, options) => {
    const [, Key] = resolveIndex(definition, { ...key, index: "table" });
    const { Item } = await definition.table.get({
      ...options,
      Key: resolveKeyValues(Key),
    });

    if (!Item) return null;

    return parseInstance(definition, entity, Item);
  };

  entity.delete = async (key, options) => {
    const [, Key] = resolveIndex(definition, { ...key, index: "table" });
    const condition = generateConditionExpression(options?.conditions);

    await definition.table.delete({ Key: resolveKeyValues(Key), ...condition });
  };

  return entity as Entity<EntityDefinition<S, TI, IX, D>, IX>;
};
