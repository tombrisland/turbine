import { z } from "zod";

import { TurbineError } from "./error";
import { buildValue } from "./expressions";
import type {
  Entity,
  EntityDefinition,
  IndexName,
  Instance,
  KeyConditionPrimitiveValue,
  PagedResult,
  QueryKey,
  TableKey,
} from "./types/entity";
import type { KeyDefinitionPrimitive } from "./types/key";
import type { TableIndexDefinition } from "./types/table";

export const parsePagedResult = async <D extends EntityDefinition<z.ZodObject>>(
  definition: D,
  entity: Entity<D>,
  items: unknown[] | undefined | null,
  lastEvaluatedKey: Record<string, any> | undefined,
  next?: () => Promise<PagedResult<D>>,
): Promise<PagedResult<D>> => {
  const output: PagedResult<D> = await Promise.all(
    (items || []).map((item) => parseInstance(definition, entity, item)),
  );

  if (lastEvaluatedKey) {
    output.lastEvaluatedKey = lastEvaluatedKey;
    if (next) {
      output.next = next;
    }
  }

  return output;
};

export const resolveKeyValues = (key: Record<string, any>) =>
  Object.entries(key).reduce(
    (
      acc: Record<string, KeyConditionPrimitiveValue>,
      [k, v]: [string, any],
    ) => {
      if (typeof v === "object" && !Array.isArray(v)) {
        if ("equals" in v) {
          v = v.equals;
        } else {
          throw new TurbineError(
            "When using `get`, the only valid key expression is `equals`.",
          );
        }
      }
      acc[k] = buildValue(v);
      return acc;
    },
    {},
  );

export const resolveIndex = <
  D extends EntityDefinition<z.ZodObject>,
  IX extends Record<string, TableIndexDefinition>,
>(
  definition: D,
  key: QueryKey<IX>,
): [IndexName, any] => {
  const k = key as Record<string, unknown>;
  const indexName = (k["index"] || "table") as IndexName;
  const index = definition.table.definition.indexes[indexName];

  if (!index) {
    throw new TurbineError(
      `Index with name "${indexName}" is not defined in table "${definition.table.definition.name}"`,
    );
  }

  if (
    !(index.hashKey in k) ||
    k[index.hashKey] === null ||
    k[index.hashKey] === undefined
  ) {
    throw new TurbineError(`No value found for hash key "${index.hashKey}"`);
  }

  const resolvedKey: Record<string, unknown> = {
    [index.hashKey]: k[index.hashKey],
  };

  if (index.rangeKey && k[index.rangeKey] !== undefined) {
    resolvedKey[index.rangeKey] = k[index.rangeKey];
  }

  return [indexName, resolvedKey];
};

export const expandPayload = async <
  S extends z.ZodObject,
  D extends EntityDefinition<S>,
>(
  definition: D,
  data: Partial<z.infer<D["schema"]>> &
    Omit<z.infer<D["schema"]>, keyof D["keys"]>,
): Promise<Partial<z.infer<D["schema"]>>> => {
  const parsedData = await definition.schema.parseAsync(data);
  return {
    ...parsedData,
    ...parseKeys(definition, parsedData),
  };
};

export const expandPartialPayload = async <S extends z.ZodObject>(
  definition: EntityDefinition<S>,
  data: Partial<z.infer<S>>,
): Promise<Partial<Record<string, KeyDefinitionPrimitive>>> => {
  const parsedData = await definition.schema.partial().parseAsync(data);
  return {
    ...parsedData,
    ...parseKeys(definition, parsedData),
  };
};

export const parseKeys = <S extends z.ZodObject>(
  definition: EntityDefinition<S>,
  data: Record<string, unknown>,
): Partial<Record<string, KeyDefinitionPrimitive>> => {
  const keys: Partial<Record<string, KeyDefinitionPrimitive>> = {};
  for (const key in definition.keys) {
    let value = definition.keys[key];
    let invalid = false;
    if (typeof value === "function") {
      value = value(data as z.infer<S>);
    }
    if (Array.isArray(value)) {
      for (const part of value) {
        if (part === undefined) invalid = true;
      }
      value = value.join("#");
    }
    if (!invalid && value !== undefined) {
      keys[key] = value;
    }
  }
  return keys;
};

export const parseInstance = async <D extends EntityDefinition<z.ZodObject>>(
  definition: D,
  entity: Entity<D>,
  input: unknown,
): Promise<Instance<Entity<D>>> => {
  const result = await definition.schema.parseAsync(input);

  result.update = async (patch: Partial<z.infer<D["schema"]>>) => {
    const index = definition.table.definition.tableIndex;
    const typedInput = input as Record<string, KeyDefinitionPrimitive>;

    const updated = await entity.update(
      (index.rangeKey
        ? {
            [index.hashKey]: typedInput[index.hashKey],
            [index.rangeKey]: typedInput[index.rangeKey],
          }
        : {
            [index.hashKey]: typedInput[index.hashKey],
          }) as TableKey<D["table"]["definition"]["indexes"]["table"]>,
      patch,
    );
    Object.assign(result, updated);
    return updated;
  };

  return result as Instance<Entity<D>>;
};
