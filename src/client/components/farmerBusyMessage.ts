/** Presentation only: domain blockers and action eligibility stay unchanged. */
export const isFarmerBusyMessage = (reason: string | null | undefined): boolean =>
  !!reason && /farmer.*busy|busy.*farmer|empty.*hands|hands.*full|finish.*(?:harvest|plant|gather|fish|bak|brew|mill|deliver|cook)|already.*(?:harvest|plant|gather|fish|bak|brew|mill|deliver|cook)/i.test(reason);
export const farmerBusyLabel = (reason: string | null | undefined): string | null =>
  isFarmerBusyMessage(reason) ? "The farmer is busy" : reason ?? null;
