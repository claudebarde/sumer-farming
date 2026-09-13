import { and, eq, isNotNull, lte } from "drizzle-orm";

import type { DatabaseTransaction } from "../db/client";
import { farmImprovements } from "../db/schema";

export const removeCompletedImprovementDestructions = async (
  transaction: DatabaseTransaction,
  farmId: string,
  currentTime: Date
): Promise<void> => {
  await transaction
    .delete(farmImprovements)
    .where(
      and(
        eq(farmImprovements.farmId, farmId),
        isNotNull(farmImprovements.destroyCompletesAt),
        lte(farmImprovements.destroyCompletesAt, currentTime)
      )
    );
};
