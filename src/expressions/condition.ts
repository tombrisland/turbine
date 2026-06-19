import { z } from "zod";

import { generateFilterExpression } from "./filter";
import type { EntityDefinition, Filters } from "../types/entity";

export const generateConditionExpression = <
  D extends EntityDefinition<z.ZodObject>,
>(
  conditions?: Filters<D>,
) => {
  const result = generateFilterExpression(conditions, "condition");
  if (!result.FilterExpression) return {};

  return {
    ConditionExpression: result.FilterExpression,
    ExpressionAttributeNames: result.ExpressionAttributeNames,
    ExpressionAttributeValues: result.ExpressionAttributeValues,
  };
};
