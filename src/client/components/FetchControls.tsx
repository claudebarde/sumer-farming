import { useStore } from "zustand";
import { Popover } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import { TILE_SIZE } from "../game/phaser/config";
import { fetchStore } from "../stores/fetchStore";
import styles from "../styles/GameCanvas.module.scss";

export default function FetchControls({
  boundary
}: {
  readonly boundary: HTMLElement | null;
}) {
  const { phase, message, menuPosition, set } = useStore(fetchStore);
  if (phase === "idle") return null;
  if (phase === "menu")
    return (
      <Popover.Root
        open
        onOpenChange={open => {
          if (!open) set("idle");
        }}
      >
        <Popover.Anchor asChild>
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: menuPosition?.x ?? 0,
              top: (menuPosition?.y ?? 0) - 24,
              width: 0,
              height: 48,
              pointerEvents: "none"
            }}
          />
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            className={styles["tile-popover"]}
            style={{
              maxWidth: `min(${TILE_SIZE * 5}px, calc(100vw - 24px), var(--radix-popover-content-available-width))`
            }}
            side="top"
            align="center"
            sideOffset={10}
            collisionPadding={12}
            collisionBoundary={boundary}
            avoidCollisions
            sticky="always"
            aria-label="Farm dog"
            onInteractOutside={event => event.preventDefault()}
          >
            <div className={styles["tile-popover-content"]}>
              <div className={styles["tile-popover-content-header"]}>
                <span className="cuneiforms">𒌨𒂠</span>
                Farm dog
              </div>
              <div className={styles["tile-popover-content-body"]}>
                <p>
                  Land the stick ahead of the dog before it stops. Watch for its
                  slowdown!
                </p>
                <button onClick={() => set("starting")}>Play Fetch</button>
              </div>
            </div>
            <Popover.Close
              className={styles["tile-popover-close"]}
              aria-label="Close dog popup"
            >
              <Cross2Icon />
            </Popover.Close>
            <Popover.Arrow className={styles["tile-popover-arrow"]} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  return (
    <aside className={styles["fishing-controls"]} aria-label="Play fetch">
      <strong>Play fetch</strong>
      <span role="status">
        {message ||
          "Land the stick ahead of the dog before it stops. Watch for its slowdown!"}
      </span>
      {phase === "result" ? (
        <>
          <small>No resources or happiness are gained or lost.</small>
          <button onClick={() => set("starting")}>Play again</button>
        </>
      ) : (
        <small>
          Move to aim, click to throw. Touch: drag and release. Keyboard: arrow
          keys to aim, Space to throw.
        </small>
      )}
      <button onClick={() => set("idle")}>
        {phase === "result" ? "Close" : "Stop playing"}
      </button>
    </aside>
  );
}
