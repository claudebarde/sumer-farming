import { ZigguratSchema, ZigguratDonationResponseSchema, type ZigguratDonationCommand } from "../../schemas/ziggurat";
import { developmentPlayerHeaders } from "./developmentPlayer";

export const requestZiggurat = async (signal: AbortSignal, interested?: boolean) => {
  const response = await fetch("/api/neighbourhood/ziggurat", {
    method: interested === undefined ? "GET" : "POST", signal, cache: "no-store",
    headers: { ...developmentPlayerHeaders(), "content-type": "application/json" },
    ...(interested === undefined ? {} : { body: JSON.stringify({ interested }) })
  });
  if (!response.ok) throw new Error("Could not update the ziggurat. Please try again.");
  return ZigguratSchema.parse(await response.json());
};

export class DonationRejected extends Error {}
export const sendZigguratDonation = async (command: ZigguratDonationCommand, signal: AbortSignal) => {
  const response = await fetch("/api/neighbourhood/ziggurat/donations", {
    method: "POST", signal, headers: { ...developmentPlayerHeaders(), "content-type": "application/json" },
    body: JSON.stringify(command)
  });
  if (response.status === 400 || response.status === 409) {
    const body = await response.json() as { error?: { message?: string } };
    throw new DonationRejected(body.error?.message ?? "Review your donation and try again.");
  }
  if (!response.ok) throw new Error("Could not confirm your donation. Retry to check it safely.");
  return ZigguratDonationResponseSchema.parse(await response.json());
};
