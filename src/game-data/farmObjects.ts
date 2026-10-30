import { z } from "zod";

export const farmDecorationTypes = ["rock", "bush"] as const;

export const farmObjectTypes = [...farmDecorationTypes, "reeds", "miniatureZiggurat"] as const;

export const FarmObjectTypeSchema = z.enum(farmObjectTypes);

export type FarmObjectType = z.infer<typeof FarmObjectTypeSchema>;

/** Roads and canals may clear scenery, but never resource sources. */
export const isClearableScenery = (type: FarmObjectType): boolean =>
  farmDecorationTypes.some(decoration => decoration === type);
