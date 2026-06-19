import type { GetCommandInput, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";

import type { ComputedFieldDefinition } from "./computed";
import type { Table, TableDefinition, TableIndexDefinition } from "./table";

export type ComputedFields<T = any, Keys extends string = string> = {
  [K in Keys]: ComputedFieldDefinition<T>;
};

export type EntityDefinition<
  S extends z.ZodObject = z.ZodObject,
  TI extends TableIndexDefinition = TableIndexDefinition,
  IX extends Record<string, TableIndexDefinition> = Record<
    string,
    TableIndexDefinition
  >,
  D extends Record<string, any> = Record<string, any>,
> = {
  table: Table<TableDefinition<TI, IX>>;
  schema: S;
  computed?: D;
};

export type PagedResult<
  D extends EntityDefinition,
  IX extends Record<string, TableIndexDefinition> = Record<
    string,
    TableIndexDefinition
  >,
> = Instance<Entity<D, IX>>[] & {
  lastEvaluatedKey?: Record<string, any> | undefined;
  next?: () => Promise<PagedResult<D, IX>>;
};

export type KeyConditionPrimitiveValue = number | string | number[] | string[];

export type HashKeyConditionExpression =
  | { equals: KeyConditionPrimitiveValue }
  | KeyConditionPrimitiveValue;

export type RangeKeyConditionExpression =
  | { equals: KeyConditionPrimitiveValue }
  | { beginsWith: KeyConditionPrimitiveValue }
  | { greaterThan: KeyConditionPrimitiveValue }
  | { lessThan: KeyConditionPrimitiveValue }
  | { greaterThanOrEquals: KeyConditionPrimitiveValue }
  | { lessThanOrEquals: KeyConditionPrimitiveValue }
  | { between: [KeyConditionPrimitiveValue, KeyConditionPrimitiveValue] }
  | KeyConditionPrimitiveValue;

export type FilterExpression =
  | { equals: any }
  | { notEquals: any }
  | { greaterThan: any }
  | { lessThan: any }
  | { greaterThanOrEquals: any }
  | { lessThanOrEquals: any }
  | { between: [any, any] }
  | { contains: any }
  | { notContains: any }
  | { beginsWith: any }
  | { exists: true }
  | { notExists: true }
  | KeyConditionPrimitiveValue;

export type UpdateFieldExpression =
  | { increment: number }
  | { decrement: number }
  | { append: any[] }
  | { prepend: any[] }
  | { ifNotExists: any }
  | { addToSet: any }
  | { deleteFromSet: any }
  | { remove: true };

type DepthLimit = [never, 0, 1, 2, 3];
export type NestedPaths<
  T,
  Depth extends number = 3,
  Prefix extends string = "",
> = Depth extends 0
  ? never
  : {
      [K in keyof T & string]: NonNullable<T[K]> extends any[]
        ? `${Prefix}${K}`
        : NonNullable<T[K]> extends object
          ?
              | NestedPaths<
                  NonNullable<T[K]>,
                  DepthLimit[Depth],
                  `${Prefix}${K}.`
                >
              | `${Prefix}${K}`
          : `${Prefix}${K}`;
    }[keyof T & string];

export type FieldConditions<D extends EntityDefinition> = {
  [K in NestedPaths<z.infer<D["schema"]>>]?: FilterExpression;
};

export type FilterGroup<D extends EntityDefinition> =
  | FieldConditions<D>
  | { and: FilterGroup<D>[] }
  | { or: FilterGroup<D>[] };

export type Filters<D extends EntityDefinition> = FilterGroup<D>;

export type Conditions<D extends EntityDefinition> = FilterGroup<D>;

export type QueryOptions<D extends EntityDefinition> = Omit<
  QueryCommandInput,
  | "TableName"
  | "IndexName"
  | "KeyConditionExpression"
  | "ExpressionAttributeNames"
  | "ExpressionAttributeValues"
> & {
  filters?: Filters<D>;
};

export type IndexName = string | "table";

type QueryKeyForIndex<
  IndexKey extends string,
  TI extends TableIndexDefinition,
> = { index?: IndexKey } & {
  [HH in TI["hashKey"]]: HashKeyConditionExpression;
} & {
  [RR in NonNullable<TI["rangeKey"]>]?: RangeKeyConditionExpression;
};

export type QueryKey<IX extends Record<string, TableIndexDefinition>> = {
  [K in keyof IX]: QueryKeyForIndex<K & string, IX[K]>;
}[keyof IX];

export type ExactKeyExpression =
  | { equals: KeyConditionPrimitiveValue }
  | KeyConditionPrimitiveValue;

export type TableKey<T extends TableIndexDefinition> =
  NonNullable<T["rangeKey"]> extends string
    ? {
        [HH in T["hashKey"]]: ExactKeyExpression;
      } & {
        [RR in NonNullable<T["rangeKey"]>]: ExactKeyExpression;
      }
    : {
        [HH in T["hashKey"]]: ExactKeyExpression;
      };

// Resolve computed field keys from entity definition
type ResolveComputedKeys<D extends EntityDefinition> =
  D extends EntityDefinition<any, any, any, infer Comp>
    ? string extends keyof Comp
      ? never
      : keyof Comp & string
    : never;

type StoredInstance<D extends EntityDefinition> = z.infer<D["schema"]>;

export type UpdatePatch<D extends EntityDefinition> = {
  [K in keyof z.infer<D["schema"]>]?:
    | z.infer<D["schema"]>[K]
    | UpdateFieldExpression
    | null;
} & {
  [K in NestedPaths<z.infer<D["schema"]>>]?: any | UpdateFieldExpression | null;
};

export type Entity<
  D extends EntityDefinition,
  IX extends Record<string, TableIndexDefinition> = Record<
    string,
    TableIndexDefinition
  >,
> = {
  definition: D;
  get(
    key: TableKey<D["table"]["definition"]["tableIndex"]>,
    options?: Omit<GetCommandInput, "TableName" | "Key">,
  ): Promise<Instance<Entity<D, IX>> | null>;
  query(
    key: QueryKey<IX>,
    options?: QueryOptions<D>,
  ): Promise<PagedResult<D, IX>>;
  queryOne(
    key: QueryKey<IX>,
    options?: QueryOptions<D>,
  ): Promise<Instance<Entity<D, IX>> | null>;
  queryAll(
    key: QueryKey<IX>,
    options?: QueryOptions<D>,
  ): Promise<Instance<Entity<D, IX>>[]>;
  put(
    data: Partial<z.input<D["schema"]>> &
      Omit<z.input<D["schema"]>, ResolveComputedKeys<D>>,
    options?: { conditions?: Conditions<D> },
  ): Promise<Instance<Entity<D, IX>>>;
  update(
    key: TableKey<D["table"]["definition"]["tableIndex"]>,
    patch: UpdatePatch<D>,
    options?: { conditions?: Conditions<D> },
  ): Promise<Instance<Entity<D, IX>>>;
  delete(
    key: TableKey<D["table"]["definition"]["tableIndex"]>,
    options?: { conditions?: Conditions<D> },
  ): Promise<void>;
};

export type Instance<
  E extends Entity<EntityDefinition, Record<string, TableIndexDefinition>>,
> = StoredInstance<E["definition"]> & {
  update(
    data: UpdatePatch<E["definition"]>,
    options?: { conditions?: Conditions<E["definition"]> },
  ): Promise<Instance<E>>;
};
