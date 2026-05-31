import type { GetCommandInput, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";

import type { KeyDefinition } from "./key";
import type { Table, TableDefinition, TableIndexDefinition } from "./table";

export type EntityDefinition<
  S extends z.ZodObject,
  TI extends TableIndexDefinition = TableIndexDefinition,
  IX extends Record<string, TableIndexDefinition> = Record<
    string,
    TableIndexDefinition
  >,
> = {
  table: Table<TableDefinition<TI, IX>>;
  schema: S;
  keys: Record<string, KeyDefinition<z.infer<S>>>;
};

export type PagedResult<
  D extends EntityDefinition<z.ZodObject<any>>,
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

// Produces "a" | "b.c" | "b.d" for { a: string; b: { c: string; d: string } }
type DepthLimit = [never, 0, 1, 2, 3];
export type NestedPaths<
  T,
  Depth extends number = 3,
  Prefix extends string = "",
> = Depth extends 0
  ? never
  : {
      [K in keyof T & string]: T[K] extends object
        ?
            | NestedPaths<T[K], DepthLimit[Depth], `${Prefix}${K}.`>
            | `${Prefix}${K}`
        : `${Prefix}${K}`;
    }[keyof T & string];

export type Filters<D extends EntityDefinition<z.ZodObject>> = {
  [K in NestedPaths<z.infer<D["schema"]>>]?: FilterExpression;
};

export type Conditions<D extends EntityDefinition<z.ZodObject>> = {
  [K in NestedPaths<z.infer<D["schema"]>>]?: FilterExpression;
};

export type QueryOptions<D extends EntityDefinition<z.ZodObject>> = Omit<
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

// Build a QueryKey for a single index: { index?: IndexName } & TableKey<TI>
type QueryKeyForIndex<
  IndexKey extends string,
  TI extends TableIndexDefinition,
> = { index?: IndexKey } & {
  [HH in TI["hashKey"]]: HashKeyConditionExpression;
} & {
  [RR in NonNullable<TI["rangeKey"]>]?: RangeKeyConditionExpression;
};

// Union of QueryKey shapes across all indexes in the table
export type QueryKey<IX extends Record<string, TableIndexDefinition>> = {
  [K in keyof IX]: QueryKeyForIndex<K & string, IX[K]>;
}[keyof IX];

export type TableKey<T extends TableIndexDefinition> =
  NonNullable<T["rangeKey"]> extends string
    ? {
        [HH in T["hashKey"]]: HashKeyConditionExpression;
      } & {
        [RR in NonNullable<T["rangeKey"]>]: RangeKeyConditionExpression;
      }
    : {
        [HH in T["hashKey"]]: HashKeyConditionExpression;
      };

export type Entity<
  D extends EntityDefinition<z.ZodObject>,
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
  query(key: QueryKey<IX>, options?: QueryOptions<D>): Promise<PagedResult<D>>;
  queryOne(
    key: QueryKey<IX>,
    options?: QueryOptions<D>,
  ): Promise<Instance<Entity<D, IX>> | null>;
  queryAll(
    key: QueryKey<IX>,
    options?: QueryOptions<D>,
  ): Promise<Instance<Entity<D, IX>>[]>;
  put(
    data: Partial<z.infer<D["schema"]>> &
      Omit<z.infer<D["schema"]>, keyof D["keys"]>,
    options?: { conditions?: Conditions<D> },
  ): Promise<Instance<Entity<D, IX>>>;
  update(
    key: TableKey<D["table"]["definition"]["tableIndex"]>,
    patch: Partial<z.infer<D["schema"]>>,
    options?: { conditions?: Conditions<D> },
  ): Promise<Instance<Entity<D, IX>>>;
  delete(
    key: TableKey<D["table"]["definition"]["tableIndex"]>,
    options?: { conditions?: Conditions<D> },
  ): Promise<void>;
};

export type Instance<
  E extends Entity<
    EntityDefinition<z.ZodObject>,
    Record<string, TableIndexDefinition>
  >,
> = z.infer<E["definition"]["schema"]> & {
  update(
    data: Partial<z.infer<E["definition"]["schema"]>>,
  ): Promise<Instance<E>>;
};
