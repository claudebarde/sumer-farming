import { Dialog } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import styles from "../styles/GameCanvas.module.scss";

export default function HarvestInfoDialog({ limit, happiness, started }: {
  readonly limit: number;
  readonly happiness: number;
  readonly started: boolean;
}) {
  return <Dialog.Root>
    <Dialog.Trigger asChild><button type="button" className="nes-btn">Info</button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className={styles["market-dialog-overlay"]} />
      <Dialog.Content className={styles["market-dialog-content"]}>
        <header className={styles["market-dialog-header"]}>
          <Dialog.Title>Harvest multiple fields</Dialog.Title>
          <Dialog.Close asChild><button className={styles["market-dialog-close"]} aria-label="Close harvesting info"><Cross2Icon /></button></Dialog.Close>
        </header>
        <div className={styles["market-dialog-body"]}>
          <Dialog.Description>Select ripe barley fields, then let the farmer harvest them one after another.</Dialog.Description>
          <p>{limit} fields maximum{started ? " (locked for this batch)" : ""} · {happiness}% current happiness</p>
          <ul>
            <li>Tap yellow fields to select them and green fields to deselect. Fields do not need to be adjacent.</li>
            <li>Red means the selection limit is reached. Deselect a field to choose another.</li>
          </ul>
          <h3>Happiness and batch size</h3>
          <ul>
            <li>50% or below: 4 fields (8 barley).</li>
            <li>Above 50%, up to 90%: 6 fields (12 barley).</li>
            <li>Above 90%: 8 fields (16 barley).</li>
          </ul>
          <p>The limit is locked when harvesting starts. Later happiness changes do not interrupt the batch.</p>
          <p>Start with empty hands. Each field takes 10 seconds plus travel and yields 2 barley. The chip above the farmer shows how much he is carrying.</p>
          <p>Harvesting continues while you are away. “Stop after this field” finishes the current field and leaves the others untouched. Deliver the harvested barley to the farm or a granary afterwards.</p>
          <Dialog.Close asChild><button type="button">Got it</button></Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
