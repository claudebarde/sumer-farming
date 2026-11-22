import { type Attendance } from "../../game-data/attendance";
import bar from "../styles/IsometricTest.module.scss";
import { Tabs, Tooltip } from "radix-ui";
import { CheckIcon, CubeIcon, LockClosedIcon } from "@radix-ui/react-icons";
import { ACHIEVEMENT_TREASURES, type AchievementKey } from "../../game-data/achievementTreasures";
import { ACHIEVEMENT_ARTWORK } from "../game/home/achievementArtwork";
import { HOME_FURNITURE, type FurnitureKey, type FurniturePlacement } from "../../game-data/homeFurniture";
import { FURNITURE_ARTWORK } from "../game/home/furnitureArtwork";
import drawer from "../styles/GameCanvas.module.scss";
import styles from "../styles/HomeInterior.module.scss";

const categories = [
  { key: "furnishings", label: "Furnishings" },
  { key: "storage", label: "Storage & pottery" },
  { key: "kitchen", label: "Kitchen" },
  { key: "achievements", label: "Achievements" },
] as const;
type Category = typeof categories[number]["key"];
const itemCategories = {
  "potted-myrtle": "achievements",
  "golden-drinking-cup": "achievements",
  "patterned-reed-chest": "achievements",
  "fine-household-pottery-set": "achievements",
  "painted-large-jar": "achievements",
  "indoor-kitchen": "kitchen",
  "reed-mat": "furnishings",
  "wooden-stool": "furnishings",
  "wooden-table": "furnishings",
  "woven-basket": "storage",
  "woven-basket-2": "storage",
  "plain-jar": "storage",
  "clay-bowl": "storage",
  "clay-bowl-2": "storage",
} satisfies Record<FurnitureKey, Category>;

export default function HomeFurnitureCatalogue({ level, furniture, earned = [], attendance, onSelect }: {
  readonly level: number;
  readonly attendance?: Attendance;
  readonly earned?: readonly AchievementKey[];
  readonly furniture: readonly FurniturePlacement[];
  readonly onSelect: (key: FurnitureKey, placed: boolean) => void;
}) {
  const attendanceState = attendance ?? { streak: 0, unlocked: false };
  const myrtlePlaced = furniture.some(item => item.key === "potted-myrtle");
  return <Tabs.Root defaultValue="furnishings" className={`${drawer["manage-tabs"]} ${styles.furnitureTabs}`}>
    <Tabs.List className={drawer["manage-tabs-list"]} aria-label="Furniture categories">
      {categories.filter(category => category.key !== "kitchen" || level >= 11).map(category =>
        <Tabs.Trigger key={category.key} value={category.key} className={drawer["manage-tabs-trigger"]}>{category.label}</Tabs.Trigger>)}
    </Tabs.List>
    {categories.map(category => <Tabs.Content key={category.key} value={category.key}
      className={`${drawer["manage-tabs-content"]} ${styles.furnitureBody}`}>
      <div className={styles.items}>
        {category.key === "achievements" && <Tooltip.Provider delayDuration={300}><Tooltip.Root>
          <Tooltip.Trigger asChild><span tabIndex={0} style={{ display: "flex" }} aria-label="Attendance reward rules">
            <button disabled={!attendanceState.unlocked} className={styles.lockedFurniture}
              style={{ width: "100%" }} data-placed={myrtlePlaced ? "true" : undefined}
              onClick={() => onSelect("potted-myrtle", myrtlePlaced)}>
              <img src={FURNITURE_ARTWORK["potted-myrtle"]} alt="" draggable={false} />
              <strong>Flowering myrtle</strong>
              <span className={styles.achievementRequirements}><span>Attendance reward</span>
                {!attendanceState.unlocked && <span>{attendanceState.streak}/5 active days</span>}
              </span>
              <span className={styles.itemDetails}><span className={styles.placementStatus}>
                {!attendanceState.unlocked ? <LockClosedIcon aria-hidden="true" /> : myrtlePlaced ? <CheckIcon aria-hidden="true" /> : <CubeIcon aria-hidden="true" />}
                {!attendanceState.unlocked ? "Locked" : myrtlePlaced ? "Placed" : "Available"}
              </span></span>
            </button>
          </span></Tooltip.Trigger>
          <Tooltip.Portal><Tooltip.Content className={bar.navigationTooltip} side="left" sideOffset={6}>
            Complete work or trade on five consecutive UTC days. After unlocking, you may miss one day.
            Two full missed days lock the plant and remove it from your home. Earn five consecutive days to get it back.
            <Tooltip.Arrow className={bar.navigationTooltipArrow} />
          </Tooltip.Content></Tooltip.Portal>
        </Tooltip.Root></Tooltip.Provider>}
        {category.key === "achievements" && ACHIEVEMENT_TREASURES.map(item => {
          const unlocked = earned.includes(item.id);
          const placed = furniture.some(placement => placement.key === item.id);
          return <button key={item.id} disabled={!unlocked} className={styles.lockedFurniture}
            data-placed={placed ? "true" : undefined}
            onClick={() => onSelect(item.id, placed)}
            aria-label={`${item.item}, ${unlocked ? placed ? 'placed in your home' : 'available to place' : 'locked'}. ${item.requirements.join('. ')}`}>
            <img src={ACHIEVEMENT_ARTWORK[item.id]} alt="" draggable={false} />
            <strong>{item.id === "painted-large-jar" ? "Painted large jar" : item.item}</strong>
            <span className={styles.achievementRequirements}>
              {item.requirements.map(requirement => <span key={requirement}>{requirement}</span>)}
              {item.id === "painted-large-jar" && <span>Replaces the regular large jar</span>}
            </span>
            <span className={styles.itemDetails}><span className={styles.placementStatus}>
              {!unlocked ? <LockClosedIcon aria-hidden="true" /> : placed ? <CheckIcon aria-hidden="true" /> : <CubeIcon aria-hidden="true" />}
              {!unlocked ? "Locked" : placed ? "Placed" : "Available"}
            </span></span>
          </button>; })}
        {HOME_FURNITURE.filter(item => itemCategories[item.key] === category.key && category.key !== "achievements" && !(item.key === "plain-jar" && earned.includes("painted-large-jar")) && (item.key !== "indoor-kitchen" || level >= 11)).map(item => {
          const placed = furniture.some(placement => placement.key === item.key);
          const number = item.key.startsWith("woven-basket") || item.key.startsWith("clay-bowl") ? (item.key.endsWith("-2") ? " 2" : " 1") : "";
          return <button key={item.key} data-placed={placed ? "true" : undefined}
            aria-label={`${item.name}${number}, ${placed ? "placed in your home" : "available to place"}`}
            onClick={() => onSelect(item.key, placed)}>
            <img src={FURNITURE_ARTWORK[item.key]} alt="" draggable={false} />
            <strong>{item.name}{number}</strong>
            <span className={styles.itemDetails}>
              <span className={styles.placementStatus} data-placed={placed}>
                {placed ? <CheckIcon aria-hidden="true" /> : <CubeIcon aria-hidden="true" />}
                {placed ? "Placed" : "Available"}
              </span>
            </span>
          </button>;
        })}
      </div>
    </Tabs.Content>)}
  </Tabs.Root>;
}
