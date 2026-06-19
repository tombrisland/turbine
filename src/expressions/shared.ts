export const buildValue = (value: any) => {
  if (Array.isArray(value)) {
    value = value.join("#");
  }
  return value;
};

// Resolves a dot-notation path (e.g. "meta.category") into a DynamoDB
// expression path with ExpressionAttributeNames placeholders.
// With prefix "filter": "#filter_meta.#filter_category"
// Without prefix: "#meta.#category"
export const resolvePath = (
  attr: string,
  prefix: "filter" | "update" | "condition" | "key",
  names: Record<string, string>,
): string => {
  const segments = attr.split(".");
  const pre = prefix ? `${prefix}_` : "";
  const path = segments.map((s) => `#${pre}${s}`).join(".");
  for (const s of segments) names[`#${pre}${s}`] = s;
  return path;
};
