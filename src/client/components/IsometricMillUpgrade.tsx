import { useRef, useState } from "react";
import type { FarmSnapshot } from "../../schemas/farm";
import { activeBuildingUpgrade, buildingLevel, BUILDING_UPGRADES } from "../../game-data/buildingUpgrades";
import { buildingUpgradeUnavailableReason } from "../../game-core/farm/buildingUpgrades";
import { executeGameCommand } from "../api/gameActions";
import { farmStore } from "../stores/farmStore";
import ProductionProgress from "./ProductionProgress";
import BuildingActionIcon from "./BuildingActionIcon";
import styles from "../styles/BuildingActionButton.module.scss";

/** Administrative work: deliberately independent of the farmer's busy state. */
export default function IsometricMillUpgrade({ snapshot, buildingId, now }: {
  readonly snapshot: FarmSnapshot; readonly buildingId: string; readonly now: number;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const request = useRef<{ key: string; level: number } | null>(null);
  const history = snapshot.farm.production.buildingUpgrades;
  const level = buildingLevel(history, buildingId, now);
  const active = activeBuildingUpgrade(history, buildingId, now);
  const next = BUILDING_UPGRADES.mill?.[level + 1];
  const reason = buildingUpgradeUnavailableReason(snapshot, buildingId, now);
  const upgrade = async () => {
    if (submitting.current || reason || !next) return;
    submitting.current = true; setPending(true); setError(null);
    if (!request.current || request.current.level !== level + 1) request.current = { key: crypto.randomUUID(), level: level + 1 };
    try {
      const updated = await executeGameCommand({ type: "upgrade_building", buildingId,
        targetLevel: request.current.level, idempotencyKey: request.current.key, expectedFarmVersion: snapshot.farm.version });
      farmStore.getState().setReady(updated);
      request.current = null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upgrade the mill. Please try again.");
    } finally { submitting.current = false; setPending(false); }
  };
  if (active) return <div>
    <p>Upgrading to level {active.level}</p>
    <ProductionProgress job={active} now={now} label="Mill upgrade progress" />
  </div>;
  if (!next || (snapshot.farm.progression?.level ?? 1) < next.estateLevel) return null;
  return <>
    {error && <p role="alert">{error}</p>}
    {next && <small>Upgrade for {Math.round((1 - next.productionTimeMultiplier) * 100)}% shorter milling times than level 1. Takes {Math.round(next.durationMs / 60_000)} minutes.</small>}
    <button className={styles.button} disabled={pending || reason !== null} onClick={() => void upgrade()}>
      <BuildingActionIcon kind="upgrade" />
      <span>{pending ? "Starting upgrade…" : reason ?? `Upgrade to level ${level + 1} · ${next?.cost} shekels`}</span>
    </button>
  </>;
}
