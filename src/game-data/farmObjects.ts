import { z } from "zod";

export const farmDecorationTypes = ["rock", "bush"] as const;

export const farmObjectTypes = [...farmDecorationTypes, "reeds"] as const;

export const FarmObjectTypeSchema = z.enum(farmObjectTypes);

export type FarmObjectType = z.infer<typeof FarmObjectTypeSchema>;
