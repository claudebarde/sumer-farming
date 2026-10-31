import { useRef, useState } from "react";
import { match } from "ts-pattern";
import type { FarmSnapshot } from "../../schemas/farm";
import { activeBuildingUpgrade, buildingLevel, BUILDING_UPGRADES } from "../../game-data/buildingUpgrades";
import { buildingUpgradeUnavailableReason } from "../../game-core/farm/buildingUpgrades";
import { executeGameCommand } from "../api/gameActions";
import { farmStore } from "../stores/farmStore";
import ProductionProgress from "./ProductionProgress";
import BuildingActionIcon from "./BuildingActionIcon";
import styles from "../styles/BuildingActionButton.module.scss";

/** Administrative work: deliberately independent of the farmer's busy state. */
export default function IsometricBuildingUpgrade({ snapshot, buildingId, now, onStarted }: {
  readonly snapshot: FarmSnapshot; readonly buildingId: string; readonly now: number;
  readonly onStarted: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const request = useRef<{ key: string; level: number } | null>(null);
  const history = snapshot.farm.production.buildingUpgrades;
  const level = buildingLevel(history, buildingId, now);
  const active = activeBuildingUpgrade(history, buildingId, now);
  const building = snapshot.buildings.find(building => building.id === buildingId);
  const supported = building?.type === "mill" || building?.type === "breadOven" || building?.type === "brewery";
  const next = supported ? BUILDING_UPGRADES[building.type]?.[level + 1] : undefined;
  const name = match(building?.type)
    .with("mill", () => "Mill")
    .with("breadOven", () => "Bread oven")
    .with("brewery", () => "Brewery")
    .otherwise(() => "");
  const reason = buildingUpgradeUnavailableReason(snapshot, buildingId, now);
  const upgrade = async () => {
    if (submitting.current || reason || !next) return;
    submitting.current = true; setPending(true); setError(null);
    if (!request.current || request.current.level !== level + 1) request.current = { key: crypto.randomUUID(), level: level + 1 };
    try {
      const updated = await executeGameCommand({ type: "upgrade_building", buildingId,
        targetLevel: request.current.level, idempotencyKey: request.current.key, expectedFarmVersion: snapshot.farm.version });
      request.current = null;
      // Clear the map selection before publishing the changed building state;
      // otherwise the open action popup turns into the construction popup.
      onStarted();
      farmStore.getState().setReady(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not upgrade the ${name.toLowerCase()}. Please try again.`);
    } finally { submitting.current = false; setPending(false); }
  };
  if (!supported) return null;
  if (active) return <div>
    <p>Upgrading to level {active.level}</p>
    <ProductionProgress job={active} now={now} label={`${name} upgrade progress`} />
  </div>;
  if (!next || (snapshot.farm.progression?.level ?? 1) < next.estateLevel) return null;
  if (building.type === "mill" && snapshot.farm.milling?.buildingId === buildingId) return null;
  if (building.type === "breadOven" && snapshot.farm.production.baking[buildingId]) return null;
  if (building.type === "brewery" && building.beerReadyAt && Date.parse(building.beerReadyAt) > now) return null;
  return <>
    {error && <p role="alert">{error}</p>}
    <button className={styles.button} disabled={pending || reason !== null} onClick={() => void upgrade()}>
      <BuildingActionIcon kind="upgrade" />
      <span>{pending ? "Starting upgrade…" : reason ?? `Upgrade to level ${level + 1} · ${next?.cost} shekels`}</span>
    </button>
  </>;
}
