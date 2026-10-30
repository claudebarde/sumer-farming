import { useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import { ZigguratDonationCommandSchema, type Ziggurat, type ZigguratDonationCommand } from "../../schemas/ziggurat";
import { ZIGGURAT_STAGES, ZIGGURAT_RESOURCES, ZIGGURAT_LABELS, emptyMaterials, type ZigguratResource } from "../../game-data/ziggurat";
import ProductionProgress from "./ProductionProgress";
import { fetchDevelopmentFarm } from "../api/developmentPlayer";
import { farmStore } from "../stores/farmStore";
import { requestZiggurat, sendZigguratDonation, DonationRejected } from "../api/ziggurat";
import BuildingActionIcon from "./BuildingActionIcon";
import InfoAlert from "./InfoAlert";
import common from "../styles/GameCanvas.module.scss";
import actions from "../styles/BuildingActionButton.module.scss";
import styles from "../styles/ZigguratDialog.module.scss";

export default function ZigguratDialog({ open, onOpenChange, farmId, onState }: {
  open: boolean; onOpenChange: (open: boolean) => void; farmId: string;
  onState: (data: Ziggurat) => void;
}) {
  const storageKey = `ziggurat-donation:${farmId}`;
  const [quantities, setQuantities] = useState(emptyMaterials);
  const [unconfirmed, setUnconfirmed] = useState<ZigguratDonationCommand | null>(() => {
    try { const saved = ZigguratDonationCommandSchema.safeParse(JSON.parse(sessionStorage.getItem(storageKey) ?? "null")); return saved.success ? saved.data : null; }
    catch { return null; }
  });
  const [receipt, setReceipt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { if (!open) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [open]);
  const [data, setData] = useState<Ziggurat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const displayedStage = useRef<number | null>(null);
  const request = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      if (submitting.current || document.hidden) return;
      request.current?.abort();
      const controller = new AbortController(); request.current = controller;
      try {
        const next = await requestZiggurat(AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
        if (!disposed && !controller.signal.aborted) {
          const nextStage = "stage" in next.state ? next.state.stage : null;
          if (displayedStage.current !== nextStage) { setQuantities(emptyMaterials()); displayedStage.current = nextStage; }
          setData(next); onState(next); setError(null); }
      } catch (cause) {
        if (!disposed && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load the ziggurat.");
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => { disposed = true; request.current?.abort(); window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, [onState]);
  const toggleInterest = async () => {
    if (!data || submitting.current) return;
    submitting.current = true; setPending(true); setError(null);
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    try {
      const next = await requestZiggurat(AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]), !data.interested);
      if (!controller.signal.aborted) { setData(next); onState(next); }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not register interest.");
    } finally { submitting.current = false; setPending(false); }
  };
  const rememberDonation = (command: ZigguratDonationCommand | null) => {
    setUnconfirmed(command);
    if (command) sessionStorage.setItem(storageKey, JSON.stringify(command));
    else sessionStorage.removeItem(storageKey);
  };
  const donate = async () => {
    if (!data || submitting.current) return;
    submitting.current = true; setPending(true); setError(null); setReceipt(null);
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const command = unconfirmed ?? { idempotencyKey: crypto.randomUUID(), stage: data.state.type === "fundraising" ? data.state.stage : 0, ...quantities };
    try {
      // Keep the same receipt key across uncertain network failures and reloads.
      rememberDonation(command);
      const result = await sendZigguratDonation(command, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
      rememberDonation(null);
      if (!controller.signal.aborted) {
        setData(result.data); onState(result.data); setQuantities(emptyMaterials());
        setReceipt(`Donated ${ZIGGURAT_RESOURCES.filter(key => result.receipt[key] > 0).map(key => `${result.receipt[key]} ${ZIGGURAT_LABELS[key].toLowerCase()}`).join(", ")} · +${result.receipt.points} points`);
      }
      void fetchDevelopmentFarm().then(snapshot => farmStore.getState().setReady(snapshot)).catch(() => undefined);
    } catch (cause) {
      if (cause instanceof DonationRejected) rememberDonation(null);
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not confirm your donation. Please retry.");
    } finally { submitting.current = false; setPending(false); }
  };
  const stage = data && (data.state.type === "fundraising" || data.state.type === "building") ? ZIGGURAT_STAGES[data.state.stage]! : ZIGGURAT_STAGES[0];
  const materialLimit = (item: ZigguratResource) => data ? Math.max(0, Math.min(data.stock[item] - (item === "barley" ? 1 : 0), stage.materials[item] - data.funded[item])) : 0;
  const canDonate = data?.canParticipate && ZIGGURAT_RESOURCES.some(key => quantities[key] > 0) && ZIGGURAT_RESOURCES.every(key => quantities[key] <= materialLimit(key));
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className={common["market-dialog-overlay"]} />
      <Dialog.Content className={`${common["market-dialog-content"]} ${styles.dialog}`}>
        <header className={common["market-dialog-header"]}>
          <Dialog.Title>Build our neighbourhood ziggurat</Dialog.Title>
          <Dialog.Close asChild><button className={common["market-dialog-close"]} aria-label="Close ziggurat"><Cross2Icon /></button></Dialog.Close>
        </header>
        <div className={`${common["market-dialog-body"]} ${styles.body}`}>
          <Dialog.Description>Join your neighbours to build a shared monument and unlock festivals.</Dialog.Description>
          {(!data || data.state.type === "interest") && <section className={styles.benefit}>
            <BuildingActionIcon kind="leaderboard" />
            <div><h3>By contributing</h3><p>Earn points in the permanent construction leaderboard.</p>
              <p>Compete for the <strong>Ziggurat Patron badge</strong> and a decorative miniature ziggurat.</p></div>
          </section>}
          {(!data || data.state.type === "interest") && <section className={styles.benefit}>
            <BuildingActionIcon kind="neighbourhood" />
            <div><h3>Once completed</h3><p>Unlock neighbourhood festivals with temporary benefits for every construction contributor.</p>
              <p>The first festival will help crops grow faster.</p></div>
          </section>}
          {error && <InfoAlert role="alert">{error}</InfoAlert>}
          {!data && !error && <p role="status">Loading ziggurat…</p>}
          {data?.state.type === "interest" && <div className={styles.interest}>
            <strong aria-live="polite">{data.supporters.length} of {data.eligibleCount} neighbours interested</strong>
            <p>3 interested neighbours are needed to open fundraising.</p>
            {data.supporters.length > 0 && <p>{data.supporters.map(member => member.name + (member.isYou ? " (You)" : "")).join(", ")}</p>}
            <button className={actions.button} disabled={!data.canParticipate || pending} aria-pressed={data.interested}
              onClick={() => void toggleInterest()}>
              <BuildingActionIcon kind={data.interested ? "cancel" : "confirm"} />
              <span>{pending ? "Saving…" : data.interested ? "Withdraw interest" : "I’m interested"}</span>
            </button>
            {!data.canParticipate && <InfoAlert>Reach level 10 to take part.</InfoAlert>}
            <small>Expressing interest costs nothing. Donate during construction to earn points and unlock festival access.</small>
          </div>}
          {receipt && <InfoAlert>{receipt}</InfoAlert>}
          {unconfirmed && <div className={styles.interest}>
            <InfoAlert>Confirm your previous donation before making another.</InfoAlert>
            <button className={actions.button} disabled={pending} onClick={() => void donate()}><BuildingActionIcon kind="refresh" /><span>{pending ? "Checking…" : "Retry donation"}</span></button>
          </div>}
          {data?.state.type === "fundraising" && <section className={styles.interest}>
            <h3>Contribute to the fundraising</h3>
            <p>{stage.name}</p>
            {ZIGGURAT_RESOURCES.filter(key => stage.materials[key] > 0).map(item => ({ item, name: ZIGGURAT_LABELS[item] })).map(resource =>
              <div className={styles.material} key={resource.item}>
                <BuildingActionIcon kind={resource.item} />
                <div><strong>{resource.name} · {data.funded[resource.item]}/{stage.materials[resource.item]}</strong>
                  <progress aria-label={`${resource.name} donated`} max={stage.materials[resource.item]} value={data.funded[resource.item]} />
                  <p>You have {data.stock[resource.item]}</p></div>
                {data.canParticipate && <label>Donate
                  <input type="number" aria-label={`${resource.name} to donate`} min={0} max={materialLimit(resource.item)} step={1}
                    disabled={pending || unconfirmed !== null} value={quantities[resource.item]}
                    onChange={event => setQuantities(value => ({ ...value, [resource.item]: Math.max(0, Math.min(materialLimit(resource.item), Math.floor(Number(event.target.value) || 0))) }))} />
                </label>}
              </div>)}
            {data.state.stage === 1 && <small>Keep at least one stored barley for planting.</small>}
            {data.canParticipate && !unconfirmed && <>
              <small>Only materials still needed will be accepted. Donations cannot be withdrawn.</small>
              <button className={actions.button} disabled={!canDonate || pending} onClick={() => void donate()}>
                <BuildingActionIcon kind="confirm" /><span>{pending ? "Donating…" : "Confirm donation"}</span>
              </button>
            </>}
            {!data.canParticipate && <InfoAlert>Reach level 10 to contribute.</InfoAlert>}
          </section>}
          {data?.state.type === "building" && <section className={styles.interest}>
            <h3>Building: {stage.name}</h3>
            <ProductionProgress job={data.state} now={now} label={`${stage.name} construction`} />
            <p>Your farmer remains available.</p>
          </section>}
          {data?.state.type === "complete" && <InfoAlert>Your neighbourhood ziggurat is complete.</InfoAlert>}
          {data && data.contributionPoints > 0 && <p>Your contribution: <strong>{data.contributionPoints} points</strong></p>}


        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
