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

export const generateFilterExpression = <
  D extends EntityDefinition<z.ZodObject>,
>(
  filters?: Filters<D>,
  prefix = "filter",
) => {
  if (!filters || Object.keys(filters).length === 0) {
    return {};
  }

  const ExpressionAttributeNames: Record<string, string> = {};
  const ExpressionAttributeValues: Record<string, unknown> = {};

  const filterExpressions = (
    Object.entries(filters) as [string, FilterExpression][]
  ).map(([attr, expression]) => {
    // Split dot-notation paths (e.g. "meta.category") into segments
    // Each part gets its own ExpressionAttributeNames placeholder
    const segments: string[] = attr.toString().split(".");
    const attributeName = segments
      .map((segment) => `#${prefix}_${segment}`)
      .join(".");

    for (const segment of segments) {
      ExpressionAttributeNames[`#${prefix}_${segment}`] = segment;
    }

    // Dots are also invalid in ExpressionAttributeValues keys
    // Replace them with underscores (e.g. ":filter_meta_category").
    const attributeValue = `:${prefix}_${attr.toString().replace(/\./g, "_")}`;

    if (typeof expression === "object" && expression !== null) {
      if ("equals" in expression) {
        ExpressionAttributeValues[attributeValue] = buildValue(
          expression.equals,
        );
        return `${attributeName} = ${attributeValue}`;
      }
      if ("notEquals" in expression) {
        ExpressionAttributeValues[attributeValue] = buildValue(
          expression.notEquals,
        );
        return `${attributeName} <> ${attributeValue}`;
      }
      if ("greaterThan" in expression) {
        ExpressionAttributeValues[attributeValue] = buildValue(
          expression.greaterThan,
        );
        return `${attributeName} > ${attributeValue}`;
      }
      if ("lessThan" in expression) {
        ExpressionAttributeValues[attributeValue] = buildValue(
          expression.lessThan,
        );
        return `${attributeName} < ${attributeValue}`;
      }
      if ("greaterThanOrEquals" in expression) {
        ExpressionAttributeValues[attributeValue] = buildValue(
          expression.greaterThanOrEquals,
        );
        return `${attributeName} >= ${attributeValue}`;
      }
      if ("lessThanOrEquals" in expression) {
        ExpressionAttributeValues[attributeValue] = buildValue(
          expression.lessThanOrEquals,
        );
        return `${attributeName} <= ${attributeValue}`;
      }
      if ("between" in expression) {
        const [start, end] = expression.between;
        ExpressionAttributeValues[attributeValue + "1"] = buildValue(start);
        ExpressionAttributeValues[attributeValue + "2"] = buildValue(end);
        return `${attributeName} BETWEEN ${attributeValue + "1"} AND ${attributeValue + "2"}`;
      }
      if ("contains" in expression) {
        ExpressionAttributeValues[attributeValue] = buildValue(
          expression.contains,
        );
        return `contains(${attributeName}, ${attributeValue})`;
      }
      if ("notContains" in expression) {
        ExpressionAttributeValues[attributeValue] = buildValue(
          expression.notContains,
        );
        return `not contains(${attributeName}, ${attributeValue})`;
      }
      if ("beginsWith" in expression) {
        ExpressionAttributeValues[attributeValue] = buildValue(
          expression.beginsWith,
        );
        return `begins_with(${attributeName}, ${attributeValue})`;
      }
      if ("exists" in expression) {
        return `attribute_exists(${attributeName})`;
      }
      if ("notExists" in expression) {
        return `attribute_not_exists(${attributeName})`;
      }
    }

    // Default: equals
    ExpressionAttributeValues[attributeValue] = buildValue(expression);
    return `${attributeName} = ${attributeValue}`;
  });

  return {
    FilterExpression: filterExpressions.join(" AND "),
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
