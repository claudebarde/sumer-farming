import HomeVisibilityControl from "./HomeVisibilityControl";
import type { FarmSnapshot } from "../../schemas/farm";
import type { HomeVisibility } from "../../schemas/homeAppearance";
import { HOME_TABLETS, type HomeTabletKey } from "../game/phaser/homeTablets";
import { HOME_DECORATIONS, type HomeDecorationKey } from "../game/phaser/homeDecorations";
import { FARM_STYLES, type FarmStyleKey } from "../game/phaser/farmStyles";
import { Dialog, Tabs, ToggleGroup } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import { farmAppearance, FARM_EVOLUTION_SOURCES } from "../game/phaser/farmEvolution";
import drawer from "../styles/GameCanvas.module.scss";
import kitchen from "../styles/Kitchen.module.scss";
import styles from "../styles/HomeDrawer.module.scss";
import HomeInteriorPreview from "./HomeInteriorPreview";
import type { FurniturePlacement } from "../../game-data/homeFurniture";

export default function HomeDrawer({ level, selectedStyle, onStyle, selectedDecoration, onDecoration, selectedTablet, onTablet, onEnter, onClose, visibility, onSaved, furniture }: {
  readonly level: number;
  readonly furniture: readonly FurniturePlacement[];
  readonly visibility: HomeVisibility;
  readonly onSaved: (snapshot: FarmSnapshot) => void;
  readonly onEnter: () => void;
  readonly selectedTablet: HomeTabletKey;
  readonly onTablet: (tablet: HomeTabletKey) => void;
  readonly selectedDecoration: HomeDecorationKey;
  readonly onDecoration: (decoration: HomeDecorationKey) => void;
  readonly selectedStyle: FarmStyleKey;
  readonly onStyle: (style: FarmStyleKey) => void;
  readonly onClose: () => void;
}) {
  const appearance = farmAppearance(level);
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className={drawer["manage-dialog-overlay"]} />
      <Dialog.Content className={`${drawer["manage-dialog-content"]} ${kitchen.drawer}`} aria-describedby={undefined}
        onCloseAutoFocus={event => event.preventDefault()}>
        <header className={kitchen.drawerHeader}>
          <Dialog.Title>Your home</Dialog.Title>
          <Dialog.Close asChild><button aria-label="Close your home"><Cross2Icon /></button></Dialog.Close>
        </header>
        <Tabs.Root defaultValue="exterior" className={`${drawer["manage-tabs"]} ${styles.tabs}`}>
          <Tabs.List className={drawer["manage-tabs-list"]} aria-label="Home customization">
            <Tabs.Trigger value="exterior" className={drawer["manage-tabs-trigger"]}>Exterior</Tabs.Trigger>
            <Tabs.Trigger value="interior" className={drawer["manage-tabs-trigger"]}>Interior</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="exterior" className={`${drawer["manage-tabs-content"]} ${styles.body}`}>
            {level >= 9 && <h3 className={styles.styleHeading}>Choose your house style</h3>}
            {level >= 9 ? <ToggleGroup.Root type="single" value={selectedStyle} aria-label="House style"
              className={styles.styleChoices} onValueChange={value => {
                const choice = FARM_STYLES.find(style => style.key === value);
                if (choice) onStyle(choice.key);
              }}>
              {FARM_STYLES.map(style => <ToggleGroup.Item key={style.key} value={style.key}
                className={styles.styleChoice} aria-label={style.label}>
                <img src={style.source} alt="" draggable={false} />
                <span>{style.label}</span>
              </ToggleGroup.Item>)}
            </ToggleGroup.Root> : <figure className={styles.appearance}>
              <img src={FARM_EVOLUTION_SOURCES[appearance.texture as keyof typeof FARM_EVOLUTION_SOURCES]} alt="Current farmhouse exterior" />
              <figcaption>Current appearance</figcaption>
            </figure>}
            {level >= 9 && <section className={styles.decorations}>
              <h3 className={styles.styleHeading}>Doorstep decoration</h3>
              <ToggleGroup.Root type="single" value={selectedDecoration} aria-label="Doorstep decoration"
                className={styles.styleChoices} onValueChange={value => {
                  if (value === "none") onDecoration("none");
                  else {
                    const choice = HOME_DECORATIONS.find(item => item.key === value);
                    if (choice) onDecoration(choice.key);
                  }
                }}>
                {HOME_DECORATIONS.map(item => <ToggleGroup.Item key={item.key} value={item.key}
                  className={styles.styleChoice} aria-label={item.label}>
                  <img src={item.source} alt="" draggable={false} />
                  <span>{item.label}</span>
                </ToggleGroup.Item>)}
                <ToggleGroup.Item value="none" className={styles.noneChoice}>None</ToggleGroup.Item>
              </ToggleGroup.Root>
            </section>}
            {level >= 9 && <section className={styles.decorations}>
              <h3 className={styles.styleHeading}>Wall tablet</h3>
              <ToggleGroup.Root type="single" value={selectedTablet} aria-label="Wall tablet"
                className={styles.styleChoices} onValueChange={value => {
                  if (value === "none") onTablet("none");
                  else {
                    const choice = HOME_TABLETS.find(item => item.key === value);
                    if (choice) onTablet(choice.key);
                  }
                }}>
                {HOME_TABLETS.map(item => <ToggleGroup.Item key={item.key} value={item.key}
                  className={styles.styleChoice} aria-label={item.label}>
                  <img src={item.source} alt="" draggable={false} />
                  <span>{item.label}</span>
                </ToggleGroup.Item>)}
                <ToggleGroup.Item value="none" className={styles.noneChoice}>None</ToggleGroup.Item>
              </ToggleGroup.Root>
            </section>}
          </Tabs.Content>
          <Tabs.Content value="interior" className={`${drawer["manage-tabs-content"]} ${styles.body}`}>
            {level >= 10 && <HomeVisibilityControl visibility={visibility} onSaved={onSaved} />}
            <div className={styles.interiorPreview}>
              <HomeInteriorPreview furniture={furniture} tablet={selectedTablet} />
              <button onClick={onEnter}>Enter house</button>
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
