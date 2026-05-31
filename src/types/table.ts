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

export type TableDefinition = {
  documentClient?: DynamoDBDocumentClient;
  name: string;
  debug?: boolean;
  indexes: {
    table: TableIndexDefinition;
    [indexName: string]: TableIndexDefinition;
  };
};

export type Table = {
  definition: TableDefinition;
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
