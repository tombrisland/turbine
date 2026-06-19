// Try and assert whether this value is an update condition
// This is not foolproof as it can overlap with a patch update
export const isUpdateExpression = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  ("increment" in value ||
    "decrement" in value ||
    "append" in value ||
    "prepend" in value ||
    "ifNotExists" in value ||
    "addToSet" in value ||
    "deleteFromSet" in value ||
    "remove" in value);

import { resolvePath } from "./shared";

// Produce a safe value placeholder (no dots)
const createValueKey = (key: string): string => `:${key.replace(/\./g, "_")}`;

export const generateUpdateExpression = (
  patch: Record<string, unknown>,
  doNotOverwrite: string[] = [],
) => {
  const ExpressionAttributeNames: Record<string, string> = {};
  const ExpressionAttributeValues: Record<string, unknown> = {};

  const setClauses: string[] = [];
  const removeClauses: string[] = [];
  const addClauses: string[] = [];
  const deleteClauses: string[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;

    const path = resolvePath(key, "update", ExpressionAttributeNames);
    const valueKey = createValueKey(key);

    if (value === null || (isUpdateExpression(value) && "remove" in value)) {
      removeClauses.push(path);
      continue;
    }

    if (isUpdateExpression(value)) {
      if ("increment" in value) {
        ExpressionAttributeValues[valueKey] = value.increment;
        setClauses.push(`${path} = ${path} + ${valueKey}`);
      } else if ("decrement" in value) {
        ExpressionAttributeValues[valueKey] = value.decrement;
        setClauses.push(`${path} = ${path} - ${valueKey}`);
      } else if ("append" in value) {
        ExpressionAttributeValues[valueKey] = value.append;
        setClauses.push(`${path} = list_append(${path}, ${valueKey})`);
      } else if ("prepend" in value) {
        ExpressionAttributeValues[valueKey] = value.prepend;
        setClauses.push(`${path} = list_append(${valueKey}, ${path})`);
      } else if ("ifNotExists" in value) {
        ExpressionAttributeValues[valueKey] = value.ifNotExists;
        setClauses.push(`${path} = if_not_exists(${path}, ${valueKey})`);
      } else if ("addToSet" in value) {
        ExpressionAttributeValues[valueKey] = value.addToSet;
        addClauses.push(`${path} ${valueKey}`);
      } else if ("deleteFromSet" in value) {
        ExpressionAttributeValues[valueKey] = value.deleteFromSet;
        deleteClauses.push(`${path} ${valueKey}`);
      }
      continue;
    }

    // Plain value assignment
    ExpressionAttributeValues[valueKey] = value;
    if (doNotOverwrite.includes(key)) {
      setClauses.push(`${path} = if_not_exists(${path}, ${valueKey})`);
    } else {
      setClauses.push(`${path} = ${valueKey}`);
    }
  }

  const parts = [
    setClauses.length && `SET ${setClauses.join(", ")}`,
    removeClauses.length && `REMOVE ${removeClauses.join(", ")}`,
    addClauses.length && `ADD ${addClauses.join(", ")}`,
    deleteClauses.length && `DELETE ${deleteClauses.join(", ")}`,
  ];

  return {
    UpdateExpression: parts.filter(Boolean).join(" "),
    ExpressionAttributeNames,
    ...(Object.keys(ExpressionAttributeValues).length && {
      ExpressionAttributeValues,
    }),
  };
};
