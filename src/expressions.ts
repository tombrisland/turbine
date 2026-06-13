import { z } from "zod";

import type {
  EntityDefinition,
  FilterExpression,
  Filters,
} from "./types/entity";

export const generateAttributeValues = (
  patch: Record<string, unknown>,
  prefix?: string,
) => {
  return Object.entries(patch)
    .filter(([, value]) => value !== undefined && value !== null)
    .reduce(
      (patch, [key, value]) => ({
        ...patch,
        [`:${prefix || ""}${key}`]: value,
      }),
      {},
    );
};

export const generateAttributeNames = (
  patch: Record<string, unknown>,
  prefix?: string,
) => {
  return Object.entries(patch)
    .filter(([, value]) => value !== undefined)
    .reduce(
      (patch, [key]) => ({ ...patch, [`#${prefix || ""}${key}`]: key }),
      {},
    );
};

export const buildValue = (value: any) => {
  if (Array.isArray(value)) {
    value = value.join("#");
  }
  return value;
};

export const generateQueryExpression = <
  D extends EntityDefinition<z.ZodObject>,
>(
  key: Record<string, unknown>,
  filters?: Filters<D>,
) => {
  const keyCondition = generateFilterExpression(key as Filters<D>, "key");
  const filter = generateFilterExpression(filters);

  return {
    KeyConditionExpression: keyCondition.FilterExpression,
    FilterExpression: filter.FilterExpression,
    ExpressionAttributeNames: {
      ...keyCondition.ExpressionAttributeNames,
      ...filter.ExpressionAttributeNames,
    },
    ExpressionAttributeValues: {
      ...keyCondition.ExpressionAttributeValues,
      ...filter.ExpressionAttributeValues,
    },
  };
};

type FilterResult = {
  FilterExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, unknown>;
};

// Builds the expression for a single field condition, mutating the shared
// names/values accumulators. The counter ensures unique value keys across
// recursive calls.
const buildFieldExpression = (
  attr: string,
  expression: FilterExpression,
  prefix: string,
  names: Record<string, string>,
  values: Record<string, unknown>,
  counter: { n: number },
): string => {
  const id = counter.n++;

  // Split dot-notation paths (e.g. "meta.category") into segments so each
  // part gets its own ExpressionAttributeNames placeholder. DynamoDB does not
  // allow dots in placeholder keys, so "#filter_meta.category" is invalid —
  // the correct form is "#filter_meta.#filter_category".
  const segments = attr.split(".");
  const attributeName = segments.map((s) => `#${prefix}_${s}`).join(".");
  for (const s of segments) names[`#${prefix}_${s}`] = s;

  // Dots are also invalid in ExpressionAttributeValues keys, so use the
  // counter-based suffix to produce unique keys like ":filter_0", ":filter_1".
  const v = `:${prefix}_${id}`;

  if (typeof expression === "object" && expression !== null) {
    if ("equals" in expression) {
      values[v] = buildValue(expression.equals);
      return `${attributeName} = ${v}`;
    }
    if ("notEquals" in expression) {
      values[v] = buildValue(expression.notEquals);
      return `${attributeName} <> ${v}`;
    }
    if ("greaterThan" in expression) {
      values[v] = buildValue(expression.greaterThan);
      return `${attributeName} > ${v}`;
    }
    if ("lessThan" in expression) {
      values[v] = buildValue(expression.lessThan);
      return `${attributeName} < ${v}`;
    }
    if ("greaterThanOrEquals" in expression) {
      values[v] = buildValue(expression.greaterThanOrEquals);
      return `${attributeName} >= ${v}`;
    }
    if ("lessThanOrEquals" in expression) {
      values[v] = buildValue(expression.lessThanOrEquals);
      return `${attributeName} <= ${v}`;
    }
    if ("between" in expression) {
      const [start, end] = expression.between;
      values[`${v}a`] = buildValue(start);
      values[`${v}b`] = buildValue(end);
      return `${attributeName} BETWEEN ${v}a AND ${v}b`;
    }
    if ("contains" in expression) {
      values[v] = buildValue(expression.contains);
      return `contains(${attributeName}, ${v})`;
    }
    if ("notContains" in expression) {
      values[v] = buildValue(expression.notContains);
      return `not contains(${attributeName}, ${v})`;
    }
    if ("beginsWith" in expression) {
      values[v] = buildValue(expression.beginsWith);
      return `begins_with(${attributeName}, ${v})`;
    }
    if ("exists" in expression) {
      return `attribute_exists(${attributeName})`;
    }
    if ("notExists" in expression) {
      return `attribute_not_exists(${attributeName})`;
    }
  }

  // Default: primitive shorthand for equals
  values[v] = buildValue(expression);
  return `${attributeName} = ${v}`;
};

// Internal concrete type used by the recursive builder, independent of entity generics.
type FieldMap = Record<string, FilterExpression>;
type OrNode = { or: FilterNode[] };
type AndNode = { and: FilterNode[] };
type FilterNode = OrNode | AndNode | FieldMap;

const isOrNode = (f: FilterNode): f is OrNode =>
  "or" in f && Array.isArray((f as OrNode).or);
const isAndNode = (f: FilterNode): f is AndNode =>
  "and" in f && Array.isArray((f as AndNode).and);

// Recursively builds a DynamoDB filter expression from a FilterGroup tree.
const buildGroupExpression = (
  filters: FilterNode,
  prefix: string,
  names: Record<string, string>,
  values: Record<string, unknown>,
  counter: { n: number },
): string => {
  // { or: [...] } node
  if (isOrNode(filters)) {
    const parts = filters.or.map((child) =>
      buildGroupExpression(child, prefix, names, values, counter),
    );
    return parts.length === 1 ? parts[0]! : `(${parts.join(" OR ")})`;
  }

  // { and: [...] } node
  if (isAndNode(filters)) {
    const parts = filters.and.map((child) =>
      buildGroupExpression(child, prefix, names, values, counter),
    );
    return parts.length === 1 ? parts[0]! : `(${parts.join(" AND ")})`;
  }

  // Flat field map — AND-join all entries
  const parts = (Object.entries(filters) as [string, FilterExpression][]).map(
    ([attr, expression]) =>
      buildFieldExpression(attr, expression, prefix, names, values, counter),
  );
  return parts.length === 1 ? parts[0]! : parts.join(" AND ");
};

export const generateFilterExpression = <
  D extends EntityDefinition<z.ZodObject>,
>(
  filters?: Filters<D>,
  prefix = "filter",
): FilterResult => {
  if (!filters || Object.keys(filters).length === 0) return {};

  const ExpressionAttributeNames: Record<string, string> = {};
  const ExpressionAttributeValues: Record<string, unknown> = {};
  const counter = { n: 0 };

  const expr = buildGroupExpression(
    filters as FilterNode,
    prefix,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
    counter,
  );

  return {
    FilterExpression: expr,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  };
};

export const generateConditionExpression = <
  D extends EntityDefinition<z.ZodObject>,
>(
  conditions?: Filters<D>,
) => {
  const result = generateFilterExpression(conditions, "condition");
  if (!result.FilterExpression) return {};

  return {
    ConditionExpression: result.FilterExpression,
    ExpressionAttributeNames: result.ExpressionAttributeNames,
    ExpressionAttributeValues: result.ExpressionAttributeValues,
  };
};

export const generateUpdateExpression = (
  patch: Record<string, unknown>,
  doNotOverwrite: string[] = [],
) => {
  const setExpression = Object.entries(patch)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key]) => {
      let value = `:${key}`;
      if (doNotOverwrite.includes(key)) {
        value = `if_not_exists(#${key}, ${value})`;
      }
      return `#${key} = ${value}`;
    });

  const removeExpression = Object.entries(patch)
    .filter(([, value]) => value === null)
    .map(([key]) => `#${key}`);

  const expressionComponents = [
    setExpression.length && `SET ${setExpression.join(", ")}`,
    removeExpression.length && `REMOVE ${removeExpression.join(", ")}`,
  ];

  return {
    UpdateExpression: expressionComponents.filter(Boolean).join(" "),
    ExpressionAttributeNames: generateAttributeNames(patch),
    ExpressionAttributeValues: generateAttributeValues(patch),
  };
};
