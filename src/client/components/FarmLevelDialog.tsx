import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { Dialog } from "radix-ui";
import { Cross2Icon, LockClosedIcon } from "@radix-ui/react-icons";
import { evaluateProgression } from "../../game-core/farm/progression";
import {
  LEVEL_NAMES,
  LEVEL_UNLOCKS,
  LEVEL_UNLOCK_ITEMS
} from "../../game-data/progression";
import { HAPPINESS_MANAGEMENT_LEVEL } from "../../game-data/household";
import { claimFarmLevel } from "../api/claimFarmLevel";
import { farmStore } from "../stores/farmStore";
import { levelUiStore } from "../stores/levelUiStore";
import { marketUiStore } from "../stores/marketUiStore";
import styles from "../styles/GameCanvas.module.scss";

export default function FarmLevelDialog({ onLevelClaimed }: { onLevelClaimed?: (farmId: string, level: number) => void } = {}) {
  const claiming = useRef(false);
  const farm = useStore(farmStore, state => state.farm);
  const isOpen = useStore(levelUiStore, state => state.isOpen);
  const location = useStore(marketUiStore, state => state.location);
  const [clock, setClock] = useState(Date.now);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isOpen]);
  useEffect(() => {
    if (location !== "farm") levelUiStore.getState().setOpen(false);
  }, [location]);
  if (farm.type !== "ready") return null;
  const progress = evaluateProgression(farm.snapshot, clock);
  const claim = async () => {
    if (claiming.current || !progress.canClaim) return;
    claiming.current = true;
    setPending(true);
    setMessage(null);
    try {
      const snapshot = await claimFarmLevel();
      if (snapshot) {
        onLevelClaimed?.(snapshot.farm.id, snapshot.farm.progression!.level);
        setMessage(
          `Level ${snapshot.farm.progression!.level} reached! Unlocked: ${LEVEL_UNLOCKS[snapshot.farm.progression!.level]}.${snapshot.farm.progression!.level === HAPPINESS_MANAGEMENT_LEVEL ? " Your farmer now needs occasional treats to stay happy. Catch a fish and feed him to boost happiness." : ""}`
        );
      }
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "The level could not be claimed."
      );
    } finally {
      claiming.current = false;
      setPending(false);
      setClock(Date.now());
    }
  };
  const offeringDescription = progress.offerings
    .map(
      offering =>
        `${offering.quantity} ${offering.source === "prepared_food" ? "stored bread or beer in any combination (bread used first)" : offering.source === "processed_grain" ? "Flour or Brewer's Groats in any combination (Flour used first)" : offering.source === "ground_barley" ? "barley from the ground" : offering.source === "granary_barley" ? "barley from your granary" : `stored ${offering.source}`}`
    )
    .join(" and ");
  return (
    <Dialog.Root
      open={isOpen && location === "farm"}
      onOpenChange={levelUiStore.getState().setOpen}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles["market-dialog-overlay"]} />
        <Dialog.Content className={styles["market-dialog-content"]}>
          <header className={styles["market-dialog-header"]}>
            <Dialog.Title>
              Farm level {progress.level} · {LEVEL_NAMES[progress.level]}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className={styles["market-dialog-close"]}
                aria-label="Close farm levels"
              >
                <Cross2Icon />
              </button>
            </Dialog.Close>
          </header>
          <div className={styles["market-dialog-body"]}>
            <Dialog.Description>
              Complete the requirements, then claim your next level.
            </Dialog.Description>
            {message && <p role="status">{message}</p>}
            <h3>
              Level {progress.nextLevel} · {LEVEL_NAMES[progress.nextLevel]}
            </h3>
            <h4>New features</h4>
            <ul aria-label="Level unlocks">
              {LEVEL_UNLOCK_ITEMS[progress.nextLevel]?.map(unlock => (
                <li key={unlock}>{unlock}</li>
              ))}
            </ul>
            {progress.nextLevel === HAPPINESS_MANAGEMENT_LEVEL && (
              <p>
                From level 4, happiness will decrease normally. Catch fish and
                feed your farmer to keep him happy; one fish treat is available
                every 8 hours.
              </p>
            )}
            <h4>Requirements to reach level {progress.nextLevel}</h4>
            {progress.level === 1 && (
              <p>
                Build a canal beside the river to irrigate nearby arable ground,
                then plant barley beside it. These two achievements stay
                completed once earned.
              </p>
            )}
            {progress.level === 6 && (
              <p>
                Bread and beer count equally. Produce 15 and sell 10 in any
                combination during level 6.
              </p>
            )}
            <ul aria-label="Level requirements">
              {progress.requirements.map(r => (
                <li key={r.label}>
                  {r.label}: {r.current} / {r.required}{" "}
                  <span
                    className={styles["requirement-status"]}
                    data-met={r.met}
                    role="img"
                    aria-label={
                      r.met ? "Requirement met" : "Requirement not met"
                    }
                    title={r.met ? "Requirement met" : "Requirement not met"}
                  >
                    {r.met ? "✓" : "✗"}
                  </span>
                </li>
              ))}
            </ul>
            {progress.level === 8 ? (
              <p>
                During level 8, harvest 100 barley and produce 30 bread and beer
                combined. Claiming consumes 10 stored bread, or 10 stored beer
                if you have fewer than 10 bread. Mixed stocks do not qualify.
              </p>
            ) : (
              offeringDescription && (
                <p>Claiming this level consumes {offeringDescription}.</p>
              )
            )}
            {progress.level === 7 && (
              <p>
                Completed merchant requests count over your lifetime. Your mill
                donkey is kept.
              </p>
            )}
            {progress.offerings.length === 0 && (
              <p>
                {progress.level === 6
                  ? "Only production and completed sales during this level count. Claiming level 7 does not consume these goods or charge you again."
                  : "These are lifetime achievements; previously sold goods and completed deliveries are not charged again."}
              </p>
            )}
            {progress.upcoming && (
              <p>
                Levels 10–11 are upcoming. Their progression requirements are
                not implemented and they cannot be claimed yet.
              </p>
            )}
            <button
              className={styles["level-claim-button"]}
              disabled={pending || !progress.canClaim}
              onClick={() => {
                void claim();
              }}
            >
              {!pending && !progress.canClaim && (
                <LockClosedIcon aria-hidden="true" />
              )}
              {pending
                ? "Claiming level…"
                : progress.upcoming
                  ? "Upcoming level"
                  : `Claim level ${progress.nextLevel}`}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
