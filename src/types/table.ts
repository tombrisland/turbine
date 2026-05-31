import type {
  DeleteCommandInput,
  DeleteCommandOutput,
  DynamoDBDocumentClient,
  GetCommandInput,
  GetCommandOutput,
  PutCommandInput,
  PutCommandOutput,
  QueryCommandInput,
  QueryCommandOutput,
  UpdateCommandInput,
  UpdateCommandOutput,
} from "@aws-sdk/lib-dynamodb";

export type TableIndexDefinition = {
  hashKey: string;
  rangeKey?: string;
};

export type TableDefinitionInput = {
  documentClient?: DynamoDBDocumentClient;
  name: string;
  debug?: boolean;
  indexes: {
    table: TableIndexDefinition;
    [indexName: string]: TableIndexDefinition;
  };
};

export type TableDefinition<
  TI extends TableIndexDefinition = TableIndexDefinition,
  IX extends Record<string, TableIndexDefinition> = Record<string, TableIndexDefinition>,
> = {
  documentClient?: DynamoDBDocumentClient;
  name: string;
  debug?: boolean;
  tableIndex: TI;
  indexes: IX;
};

export type Table<D extends TableDefinition = TableDefinition> = {
  definition: D;
  client: DynamoDBDocumentClient;
  put: (
    params: Omit<PutCommandInput, "TableName">,
  ) => Promise<PutCommandOutput>;
  update: (
    params: Omit<UpdateCommandInput, "TableName">,
  ) => Promise<UpdateCommandOutput>;
  get: (
    params: Omit<GetCommandInput, "TableName">,
  ) => Promise<GetCommandOutput>;
  delete: (
    params: Omit<DeleteCommandInput, "TableName">,
  ) => Promise<DeleteCommandOutput>;
  query: (
    params: Omit<QueryCommandInput, "TableName">,
  ) => Promise<QueryCommandOutput>;
};
