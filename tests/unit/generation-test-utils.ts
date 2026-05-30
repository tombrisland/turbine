import { vi } from "vitest";

import type { Table } from "../../src/types/table";

// Run a code block that calls client.send and capture the input
export const captureDynamoDBCommand = async <CommandInput>(
  table: Table,
  fn: () => Promise<unknown>,
  // Some commands (update / get) want the response
  output: {
    Item?: object;
    Attributes?: object;
    Items?: object[];
    LastEvaluatedKey?: undefined;
  } = {
    Item: undefined,
  },
): Promise<CommandInput> => {
  vi.spyOn(table.client, "send").mockResolvedValue(output as never);

  await fn();
  const call = vi.mocked(table.client.send).mock.calls[0][0];

  return call.input as CommandInput;
};
