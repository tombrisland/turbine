import { TurbineError } from "./error";
import { buildValue } from "./expressions";
import type { ComputedFieldPrimitive } from "./types/computed";
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
import type { TableIndexDefinition } from "./types/table";

export const parsePagedResult = async <D extends EntityDefinition>(
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
  D extends EntityDefinition,
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

export const expandPayload = async (
  definition: EntityDefinition,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const parsedData = await definition.schema.partial().parseAsync(data);
  const computedValues = parseComputed(definition, parsedData);
  const merged = { ...parsedData, ...computedValues };
  return definition.schema.parseAsync(merged);
};

export const expandPartialPayload = async (
  definition: EntityDefinition,
  data: Partial<Record<string, unknown>>,
): Promise<Partial<Record<string, ComputedFieldPrimitive>>> => {
  const parsedData = await definition.schema.partial().parseAsync(data);
  const computedValues = parseComputed(definition, parsedData);
  const computed = (definition.computed || {}) as Record<string, any>;

  // Preserve explicitly provided values over computed values
  for (const key in computed) {
    if (key in data && data[key] !== undefined) {
      computedValues[key] = data[key] as ComputedFieldPrimitive;
    }
  }

  return { ...parsedData, ...computedValues };
};

export const parseComputed = (
  definition: EntityDefinition,
  data: Record<string, unknown>,
): Partial<Record<string, ComputedFieldPrimitive>> => {
  const computed = (definition.computed || {}) as Record<string, any>;
  const result: Partial<Record<string, ComputedFieldPrimitive>> = {};
  for (const key in computed) {
    let value = computed[key];
    let invalid = false;
    if (typeof value === "function") {
      value = value(data);
    }
    if (Array.isArray(value)) {
      for (const part of value) {
        if (part === undefined) invalid = true;
      }
      value = value.join("#");
    }
    if (!invalid && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
};

export const parseInstance = async <D extends EntityDefinition>(
  definition: D,
  entity: Entity<D>,
  input: unknown,
): Promise<Instance<Entity<D>>> => {
  const result = await definition.schema.parseAsync(input);

  result.update = async (patch: any) => {
    const index = definition.table.definition.tableIndex;
    const rawInput = input as Record<string, ComputedFieldPrimitive>;

    const updated = await entity.update(
      (index.rangeKey
        ? {
            [index.hashKey]: rawInput[index.hashKey],
            [index.rangeKey]: rawInput[index.rangeKey],
          }
        : {
            [index.hashKey]: rawInput[index.hashKey],
          }) as TableKey<D["table"]["definition"]["tableIndex"]>,
      patch,
    );
    Object.assign(result, updated);
    return updated;
  };

  return result as Instance<Entity<D>>;
};
