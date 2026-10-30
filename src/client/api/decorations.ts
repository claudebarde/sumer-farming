import { FarmSnapshotSchema } from "../../schemas/farm";
import type { DecorationCommand } from "../../schemas/decorations";
import { developmentPlayerHeaders } from "./developmentPlayer";
export const sendDecoration = async (command: DecorationCommand) => {
 const response=await fetch("/api/decorations",{method:"POST",headers:{...developmentPlayerHeaders(),"content-type":"application/json"},body:JSON.stringify(command)});
 const data=await response.json();
 if(!response.ok) {
   const error = data as { error?: { message?: string } };
   throw new Error(error.error?.message ?? "Could not update your decoration.");
 }
 return FarmSnapshotSchema.parse(data);
};
