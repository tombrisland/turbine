import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommandInput,
  DynamoDBDocumentClient,
  GetCommandInput,
  PutCommandInput,
  QueryCommand,
  QueryCommandInput,
  UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";

import { TurbineError } from "./error";
import type { Table, TableDefinition, TableDefinitionInput, TableIndexDefinition } from "./types/table";

// Helper to extract literal hashKey/rangeKey types for each GSI
type LiteralIndex<T> = T extends { hashKey: infer HK; rangeKey?: infer RK }
  ? { hashKey: HK; rangeKey?: RK }
  : never;
type LiteralIndexes<IX> = { [K in keyof IX]: LiteralIndex<IX[K]> };

export const defineTable = <
  HK extends string,
  RK extends string = never,
  const IX extends { [K in keyof IX]: { hashKey: string; rangeKey?: string } } = Record<never, never>,
>(
  definition: { indexes: { table: { hashKey: HK; rangeKey?: RK } } & IX } & Omit<TableDefinitionInput, "indexes">,
): Table<TableDefinition<{ hashKey: HK; rangeKey?: RK }, { table: { hashKey: HK; rangeKey?: RK } } & LiteralIndexes<IX>>> => {
  let client: DynamoDBDocumentClient;
  if (definition.documentClient) {
    client = definition.documentClient;
  } else {
    client = DynamoDBDocumentClient.from(new DynamoDBClient(), {
      marshallOptions: {
        convertEmptyValues: true,
        removeUndefinedValues: true,
      },
    });
  }

  if (!definition.name) {
    throw new TurbineError("Table name is required");
  }

  if (!definition.indexes?.table) {
    throw new TurbineError("Specify at least one index called 'table'");
  }

  const log = (operation: string, params: Record<string, unknown>) => {
    if (definition.debug) {
      console.info(`✦ DDB ${definition.name}:${operation}`, params);
    }
  };

  const put = (params: Omit<PutCommandInput, "TableName">) => {
    log("put", params);
    return client.send(
      new PutCommand({ ...params, TableName: definition.name }),
    );
  };

  const update = (params: Omit<UpdateCommandInput, "TableName">) => {
    log("update", params);
    return client.send(
      new UpdateCommand({ ...params, TableName: definition.name }),
    );
  };

  const get = (params: Omit<GetCommandInput, "TableName">) => {
    log("get", params);
    return client.send(
      new GetCommand({ ...params, TableName: definition.name }),
    );
  };

  const deleteItem = (params: Omit<DeleteCommandInput, "TableName">) => {
    log("delete", params);
    return client.send(
      new DeleteCommand({ ...params, TableName: definition.name }),
    );
  };

  const query = (params: Omit<QueryCommandInput, "TableName">) => {
    log("query", params);
    return client.send(
      new QueryCommand({ ...params, TableName: definition.name }),
    );
  };

  return {
    client,
    definition: { ...definition, tableIndex: definition.indexes.table } as any,
    put,
    update,
    get,
    delete: deleteItem,
    query,
  };
};
