import { z } from "zod";

import { buildValue, resolvePath } from "./shared";
import type {
  EntityDefinition,
  FilterExpression,
  Filters,
} from "../types/entity";

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
  prefix: "filter" | "condition" | "key",
  names: Record<string, string>,
  values: Record<string, unknown>,
  counter: { n: number },
): string => {
  const id = counter.n++;
  const attributeName = resolvePath(attr, prefix, names);

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
  "or" in f && Array.isArray(f.or);
const isAndNode = (f: FilterNode): f is AndNode =>
  "and" in f && Array.isArray(f.and);

// Recursively builds a DynamoDB filter expression from a FilterGroup tree.
const buildGroupExpression = (
  filters: FilterNode,
  prefix: "filter" | "condition" | "key",
  names: Record<string, string>,
  values: Record<string, unknown>,
  counter: { n: number },
): string => {
  if (isOrNode(filters)) {
    const parts = filters.or
      .map((child) =>
        buildGroupExpression(child, prefix, names, values, counter),
      )
      .filter(Boolean);
    if (parts.length === 0) return "";
    return parts.length === 1 ? parts[0]! : `(${parts.join(" OR ")})`;
  }

  if (isAndNode(filters)) {
    const parts = filters.and
      .map((child) =>
        buildGroupExpression(child, prefix, names, values, counter),
      )
      .filter(Boolean);
    if (parts.length === 0) return "";
    return parts.length === 1 ? parts[0]! : `(${parts.join(" AND ")})`;
  }

  const entries = Object.entries(filters) as [string, FilterExpression][];
  if (entries.length === 0) return "";
  const parts = entries.map(([attr, expression]) =>
    buildFieldExpression(attr, expression, prefix, names, values, counter),
  );
  return parts.length === 1 ? parts[0]! : parts.join(" AND ");
};

export const generateFilterExpression = <
  D extends EntityDefinition<z.ZodObject>,
>(
  filters?: Filters<D>,
  prefix: "filter" | "condition" | "key" = "filter",
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

  if (!expr) return {};

  return {
    FilterExpression: expr,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  };
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
