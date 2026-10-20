import type { ReactNode } from "react";
import { Dialog, Tabs } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import type { FarmLoadState } from "../stores/farmStore";
import FarmerPanel from "./FarmerPanel";
import PorterPanel from "./PorterPanel";
import { FARM_SPRITES } from "../../assets/farmSprites";
import styles from "../styles/GameCanvas.module.scss";
import flourBagsImage from "../../assets/sprite_assets/pngs/flour-bags.png";
import groatsImage from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewers-groats-icon.png";
import shekelsImage from "../../assets/sprite_assets/pngs/shekels.png";
import barleyImage from "../../assets/sprite_assets/pngs/wheat-sheaf.png";
import breadBasketImage from "../../assets/sprite_assets/pngs/bread-basket.png";
import beerJarsImage from "../../assets/sprite_assets/pngs/beer-jars.png";
import fishImage from "../../assets/sprite_assets/pngs/fish.png";
import datesImage from "../../assets/sprite_assets/pngs/dates-basket.png";
import reedImage from "../../assets/sprite_assets/pngs/reed-bundle.png";
import clayImage from "../../assets/sprite_assets/pngs/brick-pile.png";
import { estateEmptyJars } from "../../game-core/farm/estateEmptyJars";

/** Shared drawer contents; each renderer supplies its own building placement entry. */
export default function EstateManagementContent({ farmState, storageClock, manageTab, setManageTab, buildContent, marketRoad }: {
  farmState: FarmLoadState; storageClock: number; manageTab: string;
  setManageTab: (tab: string) => void; buildContent: ReactNode;
  marketRoad?: { column: number; row: number };
}) {
  const snapshot = farmState.type === "ready" ? farmState.snapshot : null;
  const farmLevel = snapshot?.farm.progression?.level ?? 1;
  const quantity = (key: string) => snapshot?.inventory.find(item => item.itemKey === key)?.quantity ?? 0;
  const availableVessels = quantity("brewingVessels"), availableEmptyBeerJars = snapshot ? estateEmptyJars(snapshot) : 0, availableBakingTools = quantity("bakingTools");
  const totalBarley = quantity("barley") + (snapshot?.buildings.filter(building =>
    (building.type === "granary" || building.type === "warehouse") && Date.parse(building.completesAt) <= storageClock
  ).reduce((sum, building) => sum + building.storedBarley, 0) ?? 0);
  return (
        <Dialog.Portal>
          <Dialog.Overlay className={styles["manage-dialog-overlay"]} />
          <Dialog.Content className={styles["manage-dialog-content"]}>
            <Dialog.Title>Manage estate</Dialog.Title>
            <Dialog.Description>
              Review your resources and plan improvements to the farm.
            </Dialog.Description>
            <Tabs.Root value={manageTab} onValueChange={setManageTab} className={styles["manage-tabs"]}>
              <Tabs.List
                className={styles["manage-tabs-list"]}
                aria-label="Estate management sections"
              >
                <Tabs.Trigger
                  className={styles["manage-tabs-trigger"]}
                  value="build"
                >
                  Build
                </Tabs.Trigger>
                <Tabs.Trigger
                  className={styles["manage-tabs-trigger"]}
                  value="resources"
                >
                  Resources
                </Tabs.Trigger>
                <Tabs.Trigger
                  className={styles["manage-tabs-trigger"]}
                  value="farmer"
                >
                  Farmer
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content
                className={styles["manage-tabs-content"]}
                value="build"
              >
                {buildContent}
              </Tabs.Content>

              <Tabs.Content
                className={styles["manage-tabs-content"]}
                value="resources"
              >
                <h2>Resources</h2>
                {farmState.type === "ready" ? (
                  <div className={styles["resource-sections"]}>
                    <section>
                      <h3 className={styles["resource-title"]}>
                        <img
                          src={flourBagsImage}
                          alt=""
                          width={32}
                          height={32}
                          draggable={false}
                        />
                        Processed grain
                      </h3>
                      <dl className={styles["resource-list"]}>
                        <div>
                          <dt>Flour</dt>
                          <dd>
                            {farmState.snapshot.inventory.find(
                              i => i.itemKey === "flour"
                            )?.quantity ?? 0}
                          </dd>
                        </div>
                        <div>
                          <dt className={styles["resource-title"]}><img src={groatsImage} alt="" width={32} height={32} draggable={false} />Brewer's Groats</dt>
                          <dd>
                            {farmState.snapshot.inventory.find(
                              i => i.itemKey === "brewersGroats"
                            )?.quantity ?? 0}
                          </dd>
                        </div>
                      </dl>
                    </section>
                    <section>
                      <dl className={styles["resource-list"]}>
                        <div>
                          <dt className={styles["resource-title"]}>
                            <img
                              src={shekelsImage}
                              alt=""
                              width={32}
                              height={32}
                              draggable={false}
                            />
                            Shekels
                          </dt>
                          <dd>{farmState.snapshot.player.shekelBalance}</dd>
                        </div>
                      </dl>
                    </section>

                    <section>
                      <h3 className={styles["resource-title"]}>
                        <img
                          src={barleyImage}
                          alt=""
                          width={32}
                          height={32}
                          draggable={false}
                        />
                        Barley
                      </h3>
                      <dl className={styles["resource-list"]}>
                        <div className={styles["resource-total"]}>
                          <dt>Total</dt>
                          <dd>{totalBarley}</dd>
                        </div>
                      </dl>
                    </section>

                    <section>
                      <h3>Food and drink</h3>
                      <dl className={styles["resource-list"]}>
                        {(
                          [
                            {
                              key: "bread",
                              label: "Bread",
                              image: breadBasketImage
                            },
                            {
                              key: "beer",
                              label: "Beer",
                              image: beerJarsImage
                            },
                            { key: "fish", label: "Fish", image: fishImage },
                            ...(farmLevel >= 9
                              ? [
                                  {
                                    key: "dates" as const,
                                    label: "Baskets of dates",
                                    image: datesImage
                                  }
                                ]
                              : [])
                          ] as const
                        ).map(item => (
                          <div key={item.key}>
                            <dt className={styles["resource-title"]}>
                              <img
                                src={item.image}
                                alt=""
                                width={32}
                                height={32}
                                draggable={false}
                              />
                              {item.label}
                            </dt>
                            <dd>
                              {farmState.snapshot.inventory.find(
                                entry => entry.itemKey === item.key
                              )?.quantity ?? 0}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                    <section>
                      <h3>Equipment</h3>
                      <dl className={styles["resource-list"]}>
                        <div>
                          <dt>Brewing jars</dt>
                          <dd>{availableVessels}</dd>
                        </div>
                        <div>
                          <dt>Empty beer jars</dt>
                          <dd>{availableEmptyBeerJars}</dd>
                        </div>
                        <div>
                          <dt>Baking tools</dt>
                          <dd>{availableBakingTools}</dd>
                        </div>
                      </dl>
                    </section>
                    <section>
                      <h3>Animals</h3>
                      <dl className={styles["resource-list"]}>
                        <div>
                          <dt className={styles["resource-title"]}>
                            <img
                              src={FARM_SPRITES.donkey}
                              alt=""
                              width={32}
                              height={32}
                              draggable={false}
                            />
                            Mill donkey
                          </dt>
                          <dd>
                            {farmState.snapshot.inventory.find(
                              item => item.itemKey === "donkey"
                            )?.quantity ?? 0}
                          </dd>
                        </div>
                      </dl>
                    </section>
                    <section>
                      <h3>Building materials</h3>
                      <dl className={styles["resource-list"]}>
                        <div>
                          <dt className={styles["resource-title"]}>
                            <img
                              src={reedImage}
                              alt=""
                              width={32}
                              height={32}
                              draggable={false}
                            />
                            Reed
                          </dt>
                          <dd>
                            {farmState.snapshot.inventory.find(
                              i => i.itemKey === "reed"
                            )?.quantity ?? 0}
                          </dd>
                        </div>
                        <div>
                          <dt className={styles["resource-title"]}>
                            <img
                              src={clayImage}
                              alt=""
                              width={32}
                              height={32}
                              draggable={false}
                            />
                            Clay
                          </dt>
                          <dd>
                            {farmState.snapshot.inventory.find(
                              i => i.itemKey === "clay"
                            )?.quantity ?? 0}
                          </dd>
                        </div>
                      </dl>
                    </section>
                  </div>
                ) : (
                  <p>Farm resources are loading…</p>
                )}
              </Tabs.Content>
              <Tabs.Content
                className={styles["manage-tabs-content"]}
                value="farmer"
              >
                {farmState.type === "ready" ? (
                  <>
                    <FarmerPanel
                      snapshot={farmState.snapshot}
                      now={storageClock}
                    />
                    <PorterPanel
                      marketRoad={marketRoad}
                      snapshot={farmState.snapshot}
                      now={storageClock}
                    />
                  </>
                ) : (
                  <p>Farmer information is loading…</p>
                )}
              </Tabs.Content>
            </Tabs.Root>
            <Dialog.Close asChild>
              <button
                className={styles["manage-dialog-close"]}
                aria-label="Close estate management"
              >
                <Cross2Icon />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
  );
}
