// Local test identities only. Never use this selector as production authentication.
export const DEVELOPMENT_PLAYERS = [
  { key: "primary", id: "00000000-0000-4000-8000-000000000001", displayName: "Development Player" },
  { key: "second", id: "00000000-0000-4000-8000-000000000002", displayName: "Test Player 2" },
  { key: "onboarding", id: "00000000-0000-4000-8000-000000000003", displayName: "Onboarding playthrough" }
] as const;

export const resolveDevelopmentPlayer = (key: string | undefined) =>
  DEVELOPMENT_PLAYERS.find(player => player.key === (key ?? "primary"));
