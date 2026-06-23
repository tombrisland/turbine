// A computed field value can be a primitive, array (joined with #), or function
export type ComputedFieldPrimitive = string | number;
export type ComputedFieldArray = ComputedFieldPrimitive[];
export type ComputedFieldFunction<T> = (
  entity: T,
) => ComputedFieldPrimitive | ComputedFieldArray | undefined;
export type ComputedFieldDefinition<T> =
  | ComputedFieldPrimitive
  | ComputedFieldArray
  | ComputedFieldFunction<T>
  | undefined;
