import { z } from "zod";
import { ResidenceSchema, type ResidenceCommand } from "../../schemas/residence";
import { developmentPlayerHeaders } from "./developmentPlayer";

export const requestResidence = async (command?: ResidenceCommand, signal?: AbortSignal) => {
  const response = await fetch("/api/residence", {
    method: command ? "POST" : "GET", signal,
    headers: { ...developmentPlayerHeaders(), "Content-Type": "application/json" },
    ...(command ? { body: JSON.stringify(command) } : {})
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.object({ message: z.string() }) }).safeParse(data);
    throw new Error(error.success ? error.data.error.message : "Your city could not be loaded.");
  }
  return z.object({ residence: ResidenceSchema.nullable() }).parse(data).residence;
};
