import { FarmSnapshotSchema } from "../../schemas/farm";
import type { HomeAppearance } from "../../schemas/homeAppearance";
import { developmentPlayerHeaders } from "./developmentPlayer";
export const sendHomeAppearance = async (command: HomeAppearance) => {
 const response=await fetch("/api/home-appearance",{method:"POST",headers:{...developmentPlayerHeaders(),"content-type":"application/json"},body:JSON.stringify(command)});
 const data=await response.json();
 if(!response.ok) {
   const error = data as { error?: { message?: string } };
   throw new Error(error.error?.message ?? "Could not update your home.");
 }
 return FarmSnapshotSchema.parse(data);
};

export const sendHomeFurniture = async (revision: number, items: readonly import("../../game-data/homeFurniture").FurniturePlacement[]) => {
  const response = await fetch("/api/home-furniture", { method: "POST", headers: { ...developmentPlayerHeaders(), "content-type": "application/json" }, body: JSON.stringify({ revision, items }) });
  const data = await response.json();
  if (!response.ok) {
    const error = data as { error?: { message?: string } };
    throw new Error(error.error?.message ?? "Could not save your furniture. Please retry.");
  }
  return FarmSnapshotSchema.parse(data);
};
