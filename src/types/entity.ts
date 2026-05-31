import type { GetCommandInput, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";

import type { KeyDefinition } from "./key";
import type { Table, TableIndexDefinition } from "./table";

export type EntityDefinition<S extends z.ZodObject> = {
  table: Table;
  schema: S;
  keys: Record<string, KeyDefinition<z.infer<S>>>;
};

export type PagedResult<D extends EntityDefinition<z.ZodObject<any>>> =
  Instance<Entity<D>>[] & {
    lastEvaluatedKey?: Record<string, any> | undefined;
    next?: () => Promise<PagedResult<D>>;
  };

export type KeyConditionPrimitiveValue =
  | number
  | string
  | undefined
  | number[]
  | string[];

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

export type Filters<D extends EntityDefinition<z.ZodObject>> = {
  [K in keyof z.infer<D["schema"]> & keyof D["keys"]]?: FilterExpression;
};

export type Conditions<D extends EntityDefinition<z.ZodObject>> = {
  [K in keyof z.infer<D["schema"]>]?: FilterExpression;
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

export type QueryKey<D extends EntityDefinition<z.ZodObject>> = {
  index?: keyof D["table"]["definition"]["indexes"];
} & {
  [key: string]: HashKeyConditionExpression | RangeKeyConditionExpression;
};

export type TableKey<T extends TableIndexDefinition> =
  T["rangeKey"] extends string
    ? {
        [HH in T["hashKey"]]: HashKeyConditionExpression;
      } & {
        [RR in T["rangeKey"]]: RangeKeyConditionExpression;
      }
    : {
        [HH in T["hashKey"]]: HashKeyConditionExpression;
      };

export type Entity<D extends EntityDefinition<z.ZodObject>> = {
  definition: D;
  get(
    key: TableKey<D["table"]["definition"]["indexes"]["table"]>,
    options?: Omit<GetCommandInput, "TableName" | "Key">,
  ): Promise<Instance<Entity<D>> | null>;
  query(key: QueryKey<D>, options?: QueryOptions<D>): Promise<PagedResult<D>>;
  queryOne(
    key: QueryKey<D>,
    options?: QueryOptions<D>,
  ): Promise<Instance<Entity<D>> | null>;
  queryAll(
    key: QueryKey<D>,
    options?: QueryOptions<D>,
  ): Promise<Instance<Entity<D>>[]>;
  put(
    data: Partial<z.infer<D["schema"]>> &
      Omit<z.infer<D["schema"]>, keyof D["keys"]>,
    options?: { conditions?: Conditions<D> },
  ): Promise<Instance<Entity<D>>>;
  update(
    key: TableKey<D["table"]["definition"]["indexes"]["table"]>,
    patch: Partial<z.infer<D["schema"]>>,
    options?: { conditions?: Conditions<D> },
  ): Promise<Instance<Entity<D>>>;
  delete(
    key: TableKey<D["table"]["definition"]["indexes"]["table"]>,
    options?: { conditions?: Conditions<D> },
  ): Promise<void>;
};

export type Instance<E extends Entity<EntityDefinition<z.ZodObject>>> = z.infer<
  E["definition"]["schema"]
> & {
  update(
    data: Partial<z.infer<E["definition"]["schema"]>>,
  ): Promise<Instance<E>>;
};
