import { useRef, useState, type ReactNode } from "react";
import type { FarmSnapshot } from "../../schemas/farm";
import { activeBuildingUpgrade, buildingLevel, BUILDING_UPGRADES } from "../../game-data/buildingUpgrades";
import { buildingUpgradeUnavailableReason } from "../../game-core/farm/buildingUpgrades";
import { executeGameCommand } from "../api/gameActions";
import { farmStore } from "../stores/farmStore";
import TileActionButton from "./TileActionButton";
import styles from "../styles/GameCanvas.module.scss";
import { durationLabel } from "./durationLabel";

type Props = { readonly snapshot: FarmSnapshot; readonly buildingId: string; readonly now: number };
export function BuildingLevelSign({ snapshot, buildingId, now }: Props) {
  const level = buildingLevel(snapshot.farm.production.buildingUpgrades, buildingId, now);
  return <span className={styles["building-level-sign"]} aria-label={`Building level ${level}`}>Lv. {level}</span>;
}

export default function BuildingUpgradeContent({ snapshot, buildingId, now, children }: Props & { readonly children: ReactNode }) {
  const building = snapshot.buildings.find(b => b.id === buildingId);
  const history = snapshot.farm.production.buildingUpgrades;
  const level = buildingLevel(history, buildingId, now);
  const active = activeBuildingUpgrade(history, buildingId, now);
  const next = building && BUILDING_UPGRADES[building.type]?.[level + 1];
  const reason = buildingUpgradeUnavailableReason(snapshot, buildingId, now);
  const locked = next && (snapshot.farm.progression?.level ?? 1) < next.estateLevel;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ key: string; level: number } | null>(null);
  const upgrade = async () => {
    if (pending || reason) return;
    setPending(true);
    setError(null);
    request.current ??= { key: crypto.randomUUID(), level: level + 1 };
    try {
      const updated = await executeGameCommand({ type: "upgrade_building", buildingId,
        targetLevel: request.current.level, idempotencyKey: request.current.key, expectedFarmVersion: snapshot.farm.version });
      farmStore.getState().setReady(updated);
      request.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upgrade this building.");
    } finally { setPending(false); }
  };
  if (active) return <>
    <p>Upgrading to level {active.level} · Production unavailable.</p>
    <p>{durationLabel(Date.parse(active.completesAt) - now)} remaining</p>
    <progress aria-label="Building upgrade progress" max={100} value={Math.max(0, Math.min(100,
      100 * (now - Date.parse(active.startedAt)) / Math.max(1, Date.parse(active.completesAt) - Date.parse(active.startedAt))))} />
  </>;
  return <>
    {reason && next && !locked && <p>{reason}</p>}
    {error && <p role="alert">{error}</p>}
    {children}
    <TileActionButton disabled={pending || reason !== null} onClick={() => void upgrade()}>
      {!next ? "Maximum level" : locked ? `Level ${level + 1} · Unlock at estate level ${next.estateLevel}`
        : pending ? "Upgrading…" : `Upgrade to level ${level + 1} · ${next.cost} shekels`}
    </TileActionButton>
  </>;
}
