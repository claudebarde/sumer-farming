import { z } from "zod";

import {
  GameCommandSchema,
  type GameCommand
} from "../../schemas/gameCommands";
import { FarmSnapshotSchema, type FarmSnapshot } from "../../schemas/farm";

const GameActionErrorSchema = z.object({
  error: z.object({
    type: z.string(),
    message: z.string()
  })
});

export const executeGameCommand = async (
  command: GameCommand
): Promise<FarmSnapshot> => {
  const response = await fetch("/api/game/action", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(GameCommandSchema.parse(command))
  });
  const body: unknown = await response.json();

  if (!response.ok) {
    const parsedError = GameActionErrorSchema.safeParse(body);
    throw new Error(
      parsedError.success
        ? parsedError.data.error.message
        : "The game command could not be completed"
    );
  }

  return FarmSnapshotSchema.parse(body);
};
