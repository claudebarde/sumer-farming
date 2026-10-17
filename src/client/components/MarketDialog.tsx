import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { Dialog, Tabs } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import { match } from "ts-pattern";
import { farmStore } from "../stores/farmStore";
import { MARKET_TITLES, beerMarketBuyOrder, marketIncludesItem, marketUiStore } from "../stores/marketUiStore";
import { canOpenMarketStand, marketUnlockLevel } from "../../game-data/progression";
import { calculateFarmStorageCapacity, FARM_STORAGE_CAPACITY, estateResourceCapacity } from "../../game-data/storage";
import { millStorageReserved } from "../../game-core/farm/millStorage";
import { porterReserved } from "../../game-data/porter";
import { FARM_BUILDING_DEFINITIONS } from "../../game-data/buildings";
import type { MarketQuotes } from "../../schemas/market";
import type { MarketItemKey } from "../../game-data/marketItems";
import { executeGameCommand } from "../api/gameActions";
import { fetchDevelopmentFarm } from "../api/developmentPlayer";
import { fetchMarketQuotes } from "../api/marketQuotes";
import { clampMarketQuantity, marketQuantityLimit } from "../game/marketQuantity";
import { BARLEY_RESERVE_MESSAGE, violatesBarleyReserve } from "../../game-core/farm/marketSeedReserve";
import MarketListings from "./MarketListings";
import MarketTradeHistory from "./MarketTradeHistory";
import MarketTransactionPreview from "./MarketTransactionPreview";
import MarketQuantityControl from "./MarketQuantityControl";
import { FARM_SPRITES } from "../../assets/farmSprites";
import MarketJarIcon from "./MarketJarIcon";
import bakingToolsImage from "../../assets/sprite_assets/pngs/wooden-baking-tools.png";
import breadBasketImage from "../../assets/sprite_assets/pngs/bread-basket.png";
import flourBagsImage from "../../assets/sprite_assets/pngs/flour-bags.png";
import groatsImage from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewers-groats-icon.png";
import styles from "../styles/GameCanvas.module.scss";
type MarketQuoteState =
  | { readonly type: "idle" }
  | { readonly type: "loading" }
  | { readonly type: "ready"; readonly quotes: MarketQuotes }
  | { readonly type: "failed"; readonly reason: string };

const formatShekels = (quantity: number): string =>
  `${quantity} ${quantity === 1 ? "shekel" : "shekels"}`;

export default function MarketDialog() {
  const [marketQuantities, setMarketQuantities] = useState<
    Record<string, number>
  >({});
  const [marketTradePending, setMarketTradePending] = useState(false);
  const [marketTradeError, setMarketTradeError] = useState<string | null>(null);
  const [marketSellPrices, setMarketSellPrices] = useState<
    Partial<Record<MarketItemKey, number>>
  >({});
  const [marketQuoteState, setMarketQuoteState] = useState<MarketQuoteState>({
    type: "idle"
  });
  const [marketQuoteRefresh, setMarketQuoteRefresh] = useState(0);


  const farmState = useStore(farmStore, state => state.farm);
  const farmLevel = farmState.type === "ready" ? farmState.snapshot.farm.progression?.level ?? 1 : 1;
  const [storageClock, setStorageClock] = useState(() => Date.now());
  const inventory = farmState.type === "ready" ? farmState.snapshot.inventory : [];
  const buildings = farmState.type === "ready" ? farmState.snapshot.buildings : [];
  const stored = (key: string) => inventory.find(item => item.itemKey === key)?.quantity ?? 0;
  const availableVessels = stored("brewingVessels"), availableEmptyBeerJars = stored("emptyBeerJar"), availableBakingTools = stored("bakingTools");
  const missingBrewingJars = Math.max(0, FARM_BUILDING_DEFINITIONS.brewery.materials.brewingVessels - availableVessels);
  const storedHouseholdBarley = stored("barley") + buildings.filter(b => (b.type === "granary" || b.type === "warehouse") && Date.parse(b.completesAt) <= storageClock).reduce((total,b) => total + b.storedBarley, 0);
  const householdBarleyCapacity = farmState.type === "ready" ? calculateFarmStorageCapacity(buildings, storageClock, farmLevel) : FARM_STORAGE_CAPACITY;
  const availableBarleyStorage = Math.max(0, householdBarleyCapacity - storedHouseholdBarley);
  const isOpenMarketDialog = useStore(
    marketUiStore,
    state => state.isOpen && canOpenMarketStand(state.scope, farmLevel)
  );
  const marketScope = useStore(marketUiStore, state => state.scope);
  const setMarketDialogOpen = useStore(marketUiStore, state => state.setOpen);
  useEffect(() => {
    if (!isOpenMarketDialog) return;
    const timer = window.setInterval(() => setStorageClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isOpenMarketDialog]);
  const tradeMarketItem = async (
    direction: "buy" | "sell",
    itemKey: MarketItemKey,
    expectedUnitPrice: number,
    quantity: number
  ): Promise<void> => {
    if (
      farmState.type !== "ready" ||
      marketQuoteState.type !== "ready" ||
      marketTradePending
    ) {
      return;
    }

    setMarketTradePending(true);
    setMarketTradeError(null);

    try {
      const commandBase = {
        itemKey,
        quantity,
        expectedUnitPrice,
        idempotencyKey: crypto.randomUUID(),
        expectedFarmVersion: farmState.snapshot.farm.version
      } as const;
      const snapshot = await match(direction)
        .with("buy", () =>
          executeGameCommand({
            type: "buy_from_npc_market",
            ...commandBase
          })
        )
        .with("sell", () =>
          executeGameCommand({
            type: "sell_to_npc_market",
            ...commandBase
          })
        )
        .exhaustive();
      farmStore.getState().setReady(snapshot);
      setMarketQuoteRefresh(refresh => refresh + 1);
    } catch (error) {
      setMarketTradeError(
        error instanceof Error
          ? error.message
          : "The trade could not be completed"
      );
      setMarketQuoteRefresh(refresh => refresh + 1);
    } finally {
      setMarketTradePending(false);
    }
  };

  const createMarketSellOrder = async (
    itemKey: MarketItemKey,
    unitPrice: number,
    quantity: number
  ): Promise<void> => {
    if (farmState.type !== "ready" || marketTradePending) {
      return;
    }

    setMarketTradePending(true);
    setMarketTradeError(null);

    try {
      const snapshot = await executeGameCommand({
        type: "create_market_sell_order",
        itemKey,
        quantity,
        unitPrice,
        idempotencyKey: crypto.randomUUID(),
        expectedFarmVersion: farmState.snapshot.farm.version
      });
      farmStore.getState().setReady(snapshot);
      setMarketSellPrices(prices => ({ ...prices, [itemKey]: undefined }));
      setMarketQuoteRefresh(refresh => refresh + 1);
    } catch (error) {
      setMarketTradeError(
        error instanceof Error
          ? error.message
          : "The sell order could not be created"
      );
      setMarketQuoteRefresh(refresh => refresh + 1);
    } finally {
      setMarketTradePending(false);
    }
  };

  const cancelMarketSellOrder = async (orderId: string): Promise<void> => {
    if (farmState.type !== "ready" || marketTradePending) {
      return;
    }

    setMarketTradePending(true);
    setMarketTradeError(null);

    try {
      const snapshot = await executeGameCommand({
        type: "cancel_market_sell_order",
        orderId,
        expectedFarmVersion: farmState.snapshot.farm.version
      });
      farmStore.getState().setReady(snapshot);
      setMarketQuoteRefresh(refresh => refresh + 1);
    } catch (error) {
      setMarketTradeError(
        error instanceof Error
          ? error.message
          : "The sell order could not be cancelled"
      );
      setMarketQuoteRefresh(refresh => refresh + 1);
    } finally {
      setMarketTradePending(false);
    }
  };

  const buyPlayerListing = async (
    orderId: string,
    expectedUnitPrice: number,
    quantity: number
  ): Promise<void> => {
    if (farmState.type !== "ready" || marketTradePending) return;
    setMarketTradePending(true);
    setMarketTradeError(null);
    try {
      const snapshot = await executeGameCommand({
        type: "buy_market_sell_order",
        orderId,
        expectedUnitPrice,
        quantity,
        idempotencyKey: crypto.randomUUID(),
        expectedFarmVersion: farmState.snapshot.farm.version
      });
      farmStore.getState().setReady(snapshot);
    } catch (error) {
      setMarketTradeError(
        error instanceof Error
          ? error.message
          : "The purchase could not be completed"
      );
    } finally {
      setMarketTradePending(false);
      setMarketQuoteRefresh(refresh => refresh + 1);
    }
  };

  useEffect(() => {
    if (!isOpenMarketDialog) {
      return;
    }

    const controller = new AbortController();

    void Promise.all([
      fetchMarketQuotes(controller.signal),
      fetchDevelopmentFarm(controller.signal)
    ]).then(
      ([quotes, snapshot]) => {
        if (controller.signal.aborted) return;
        const current = farmStore.getState().farm;
        if (
          current.type !== "ready" ||
          current.snapshot.farm.version < snapshot.farm.version
        ) {
          farmStore.getState().setReady(snapshot);
        }
        setMarketQuoteState({ type: "ready", quotes });
      },
      error => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setMarketQuoteState({
          type: "failed",
          reason:
            error instanceof Error
              ? error.message
              : "The current market prices could not be loaded"
        });
      }
    );

    return () => {
      controller.abort();
    };
  }, [isOpenMarketDialog, marketQuoteRefresh]);

  useEffect(() => {
    if (!isOpenMarketDialog || marketTradePending) return;
    const refresh = () => setMarketQuoteRefresh(value => value + 1);
    const timer = window.setInterval(refresh, 5_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [isOpenMarketDialog, marketTradePending]);

  return (
      <Dialog.Root
        open={isOpenMarketDialog}
        onOpenChange={open => {
          setMarketDialogOpen(open);

          if (!open) {
            setMarketTradeError(null);
            setMarketQuoteState({ type: "idle" });
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={styles["market-dialog-overlay"]} />
          <Dialog.Content className={styles["market-dialog-content"]}>
            <header className={styles["market-dialog-header"]}>
              <Dialog.Title>
                {MARKET_TITLES[marketScope]}
                {marketScope === "barley" ? (
                  <span className="cuneiforms">𒆠𒇴𒊺𒀀</span>
                ) : marketScope === "beer" ? (
                  <span className="cuneiforms">𒆠𒇴𒁉𒀀</span>
                ) : marketScope === "bread" ? (
                  <span className="cuneiforms">𒆠𒇴𒃻𒀀</span>
                ) : null}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className={styles["market-dialog-close"]}
                  aria-label="Close market"
                >
                  <Cross2Icon />
                </button>
              </Dialog.Close>
            </header>
            <div className={styles["market-dialog-body"]}>
              <Dialog.Description>
                Trade {marketScope} with the NPC market or buy listings from
                other players.
              </Dialog.Description>
              {farmLevel < (marketScope === "barley" ? 3 : 6) && (
                <p role="note">
                  This market unlocks at level{" "}
                  {marketScope === "barley" ? 3 : 6}.
                </p>
              )}
              {farmState.type === "ready" &&
              marketQuoteState.type === "ready" ? (
                <div className={styles["market-trade"]}>
                  <dl className={styles["market-balances"]}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center"
                      }}
                    >
                      <dt>
                        Shekels <span className="cuneiforms small">𒂆</span>
                      </dt>
                      <dd>{farmState.snapshot.player.shekelBalance}</dd>
                    </div>
                    <div>
                      <dt>
                        {marketScope === "beer"
                          ? "Filled beer jars"
                          : marketScope === "bread"
                            ? "Stored bread"
                            : "Stored barley"}
                      </dt>
                      <dd>
                        {marketScope !== "barley"
                          ? (farmState.snapshot.inventory.find(
                              item => item.itemKey === marketScope
                            )?.quantity ?? 0)
                          : `${storedHouseholdBarley} / ${householdBarleyCapacity}`}
                      </dd>
                    </div>
                  </dl>

                  <Tabs.Root
                    key={marketScope}
                    defaultValue="npc"
                    className={styles["manage-tabs"]}
                  >
                    <Tabs.List
                      className={styles["manage-tabs-list"]}
                      aria-label="Market type"
                    >
                      <Tabs.Trigger
                        className={styles["manage-tabs-trigger"]}
                        value="npc"
                      >
                        NPC market
                      </Tabs.Trigger>
                      <Tabs.Trigger
                        className={styles["manage-tabs-trigger"]}
                        value="player"
                      >
                        Player market
                      </Tabs.Trigger>
                    </Tabs.List>
                    {(["npc", "player"] as const).map(market => (
                      <Tabs.Content
                        key={market}
                        value={market}
                        className={styles["market-tab-content"]}
                      >
                        <p>
                          {market === "npc"
                            ? "Buy and sell at fixed prices with NPC merchants."
                            : "Buy goods from other players or sell your own stored goods."}
                        </p>
                        <Tabs.Root
                          defaultValue="buy"
                          className={styles["manage-tabs"]}
                        >
                          <Tabs.List
                            className={styles["manage-tabs-list"]}
                            aria-label={
                              market === "npc"
                                ? "NPC market action"
                                : "Player market action"
                            }
                          >
                            <Tabs.Trigger
                              className={styles["manage-tabs-trigger"]}
                              value="buy"
                            >
                              Buy
                            </Tabs.Trigger>
                            <Tabs.Trigger
                              className={styles["manage-tabs-trigger"]}
                              value="sell"
                            >
                              Sell
                            </Tabs.Trigger>
                          </Tabs.List>
                          {(["buy", "sell"] as const).map(action => (
                            <Tabs.Content
                              key={action}
                              value={action}
                              className={styles["market-tab-content"]}
                            >
                              <p>
                                {market === "npc"
                                  ? action === "buy"
                                    ? "Choose a quantity to buy from NPC merchants."
                                    : "Choose a quantity of stored goods to sell to NPC merchants."
                                  : action === "buy"
                                    ? "Choose a quantity and buy from another player's listing. Your own listings are shown under Sell."
                                    : "Choose a quantity and asking price to create a listing. Manage your unsold listings below."}
                              </p>
                              {marketQuoteState.quotes.items
                                .filter(
                                  item =>
                                    farmLevel >= marketUnlockLevel(item.itemKey)
                                )
                                .filter(item =>
                                  marketIncludesItem(
                                    marketScope,
                                    item.itemKey,
                                    { market, action }
                                  )
                                )
                                .filter(item =>
                                  market === "npc"
                                    ? action === "buy"
                                      ? item.npcMarket.canBuy
                                      : item.npcMarket.canSell
                                    : item.playerMarket.canCreateSellOrder
                                )
                                .sort((a, b) => marketScope === "beer" && market === "npc" && action === "buy"
                                  ? beerMarketBuyOrder(a.itemKey) - beerMarketBuyOrder(b.itemKey)
                                  : 0)
                                .map(item => {
                                  const quantityKey = `${market}:${action}:${item.itemKey}`;
                                  const purchaseQuantityLimit =
                                    item.itemKey === "donkey"
                                      ? 1
                                      : action === "buy" &&
                                          item.itemKey === "brewingVessels"
                                        ? Math.max(1, missingBrewingJars)
                                        : undefined;
                                  const storedQuantity = match(item.itemKey)
                                    .with("barley", () => storedHouseholdBarley)
                                    .with(
                                      "bakingTools",
                                      () => availableBakingTools
                                    )
                                    .with(
                                      "beer",
                                      "bread",
                                      "flour",
                                      "brewersGroats",
                                      "donkey",
                                      () =>
                                        farmState.snapshot.inventory.find(
                                          entry =>
                                            entry.itemKey === item.itemKey
                                        )?.quantity ?? 0
                                    )
                                    .with(
                                      "brewingVessels",
                                      () => availableVessels
                                    )
                                    .with(
                                      "emptyBeerJar",
                                      () => availableEmptyBeerJars
                                    )
                                    .exhaustive();
                                  const quantityLimit = marketQuantityLimit(
                                    action,
                                    storedQuantity,
                                    purchaseQuantityLimit
                                  );
                                  const marketQuantity = clampMarketQuantity(
                                    marketQuantities[quantityKey] ?? 1,
                                    quantityLimit
                                  );
                                  const availableStorage = match(
                                    item.storageType
                                  )
                                    .with(
                                      "barley_storage",
                                      () => availableBarleyStorage
                                    )
                                    .with("estate_inventory", () =>
                                      Math.max(
                                        0,
                                        estateResourceCapacity(
                                          item.itemKey,
                                          farmState.snapshot.buildings,
                                          storageClock
                                        ) - storedQuantity
                                          - millStorageReserved(farmState.snapshot.farm, item.itemKey)
                                          - porterReserved(farmState.snapshot.farm.production.porter, item.itemKey)
                                      )
                                    )
                                    .exhaustive();
                                  const purchaseCost =
                                    marketQuantity * item.npcMarket.buyPrice;
                                  const reserveBlocked = action === "sell" && violatesBarleyReserve(item.itemKey, storedQuantity, marketQuantity);
                                  const saleValue =
                                    marketQuantity * item.npcMarket.sellPrice;
                                  const listingPrice =
                                    marketSellPrices[item.itemKey] ??
                                    item.playerMarket.suggestedSellPrice;
                                  const cuneiformLabel = () => {
                                    switch (item.itemKey) {
                                      case "barley":
                                        return "𒊺";
                                      case "brewingVessels":
                                        return "𒂁";
                                      case "emptyBeerJar":
                                        return "𒂁𒋤𒂵";
                                      case "brewersGroats":
                                        return "𒃻𒄯𒊏";
                                      case "bread":
                                        return "𒃻";
                                      case "flour":
                                        return "𒍥";
                                      default:
                                        return "";
                                    }
                                  };

                                  return (
                                    <section
                                      className={styles["market-item"]}
                                      key={item.itemKey}
                                    >
                                      <h3>
                                        {item.itemKey === "donkey" && (
                                          <img
                                            src={FARM_SPRITES.donkey}
                                            alt=""
                                            width={48}
                                            height={48}
                                          />
                                        )}
                                        {(item.itemKey === "beer" || item.itemKey === "emptyBeerJar" || item.itemKey === "brewingVessels") &&
                                          <MarketJarIcon itemKey={item.itemKey} />}
                                        {item.itemKey === "bakingTools" && (
                                          <img
                                            src={bakingToolsImage}
                                            alt=""
                                            width={48}
                                            height={48}
                                          />
                                        )}
                                        {item.itemKey === "bread" && (
                                          <img
                                            src={breadBasketImage}
                                            alt=""
                                            width={48}
                                            height={48}
                                          />
                                        )}
                                        {(item.itemKey === "flour" || item.itemKey === "brewersGroats") && (
                                          <img
                                            src={item.itemKey === "brewersGroats" ? groatsImage : flourBagsImage}
                                            alt=""
                                            width={48}
                                            height={48}
                                          />
                                        )}
                                        {item.label}
                                        <span
                                          className="cuneiforms small"
                                          style={{ marginLeft: "0.5rem" }}
                                        >
                                          {cuneiformLabel()}
                                        </span>
                                      </h3>
                                      <MarketTransactionPreview
                                        showPrice={false}
                                        itemKey={item.itemKey}
                                        label={item.label.toLowerCase()}
                                        stock={storedQuantity}
                                        balance={farmState.snapshot.player.shekelBalance}
                                        transaction={market === "npc" ? {
                                          type: action === "buy" ? "buy" : "sell",
                                          quantity: marketQuantity,
                                          unitPrice: action === "buy" ? item.npcMarket.buyPrice : item.npcMarket.sellPrice
                                        } : action === "sell" ? {
                                          type: "listing", quantity: marketQuantity, unitPrice: listingPrice
                                        } : undefined}
                                      />
                                      {item.itemKey === "beer" && (
                                        <p>
                                          Each sale includes the jar; no empty
                                          jar is returned.
                                        </p>
                                      )}
                                      {item.itemKey === "donkey" && (
                                        <p>
                                          One donkey per farm. Processes 6 barley into 3 Flour or Brewer's Groats in 15 minutes, leaving the farmer free.
                                        </p>
                                      )}
                                      <MarketQuantityControl
                                        unitPrice={market === "npc" ? (action === "buy" ? item.npcMarket.buyPrice : item.npcMarket.sellPrice) : action === "sell" ? listingPrice : undefined}
                                        priceLabel={market === "player" ? "Asking price per item" : "Price per item"}
                                        label={action === "buy" ? "Quantity to buy" : "Quantity to sell"}
                                        value={marketQuantity} limit={quantityLimit}
                                        disabled={marketTradePending || item.itemKey === "donkey" ||
                                          (item.itemKey === "brewingVessels" && action === "buy" && missingBrewingJars === 0) ||
                                          (action === "sell" && storedQuantity === 0)}
                                        onChange={quantity => setMarketQuantities(current => ({ ...current, [quantityKey]: quantity }))}
                                      />
                                      {market === "npc" && (
                                        <div
                                          className={styles["market-actions"]}
                                        >
                                          {action === "buy" && (
                                            <button
                                              disabled={
                                                marketTradePending ||
                                                (item.itemKey === "brewingVessels" && missingBrewingJars === 0) ||
                                                !item.npcMarket.canBuy ||
                                                farmState.snapshot.player
                                                  .shekelBalance <
                                                  purchaseCost ||
                                                availableStorage <
                                                  marketQuantity
                                              }
                                              onClick={() => {
                                                void tradeMarketItem(
                                                  "buy",
                                                  item.itemKey,
                                                  item.npcMarket.buyPrice,
                                                  marketQuantity
                                                );
                                              }}
                                            >
                                              {item.itemKey === "brewingVessels" && missingBrewingJars === 0
                                                ? "Already owned"
                                                : !item.npcMarket.canBuy
                                                ? "Buying unavailable"
                                                : availableStorage <
                                                    marketQuantity
                                                  ? ["donkey", "brewingVessels", "bakingTools"].includes(item.itemKey)
                                                    ? "Already owned"
                                                    : "Not enough storage"
                                                  : farmState.snapshot.player
                                                        .shekelBalance <
                                                      purchaseCost
                                                    ? "Not enough shekels"
                                                    : `Buy for ${formatShekels(purchaseCost)}`}
                                            </button>
                                          )}
                                          {action === "sell" && (
                                            <button
                                              disabled={
                                                marketTradePending ||
                                                  !item.npcMarket.canSell || reserveBlocked ||
                                                storedQuantity < marketQuantity
                                              }
                                              onClick={() => {
                                                void tradeMarketItem(
                                                  "sell",
                                                  item.itemKey,
                                                  item.npcMarket.sellPrice,
                                                  marketQuantity
                                                );
                                              }}
                                            >
                                              {reserveBlocked ? BARLEY_RESERVE_MESSAGE : !item.npcMarket.canSell
                                                ? "Selling unavailable"
                                                : storedQuantity <
                                                    marketQuantity
                                                  ? `Not enough stored ${item.label.toLowerCase()}`
                                                  : `Sell for ${formatShekels(saleValue)}`}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                      {market === "player" && (
                                        <>
                                          <dl
                                            className={
                                              styles["market-statistics"]
                                            }
                                          >
                                            <div>
                                              <dt>Lowest asking price</dt>
                                              <dd>
                                                {item.playerMarket
                                                  .lowestSellPrice === null
                                                  ? "No listings"
                                                  : formatShekels(
                                                      item.playerMarket
                                                        .lowestSellPrice
                                                    )}
                                              </dd>
                                            </div>
                                            <div>
                                              <dt>Average asking price</dt>
                                              <dd>
                                                {item.playerMarket
                                                  .weightedAverageSellPrice ===
                                                null
                                                  ? "No listings"
                                                  : formatShekels(
                                                      Number(
                                                        item.playerMarket.weightedAverageSellPrice.toFixed(
                                                          1
                                                        )
                                                      )
                                                    )}
                                              </dd>
                                            </div>
                                            <div>
                                              <dt>Quantity for sale</dt>
                                              <dd>
                                                {
                                                  item.playerMarket
                                                    .totalSellQuantity
                                                }
                                              </dd>
                                            </div>
                                            <div>
                                              <dt>
                                                Average traded price (24h)
                                              </dt>
                                              <dd>
                                                {item.playerMarket
                                                  .recentTradeAveragePrice ===
                                                null
                                                  ? "No trades in the last 24h"
                                                  : formatShekels(
                                                      Number(
                                                        item.playerMarket.recentTradeAveragePrice.toFixed(
                                                          1
                                                        )
                                                      )
                                                    )}
                                              </dd>
                                            </div>
                                          </dl>
                                          {action === "sell" && (
                                            <div
                                              className={
                                                styles[
                                                  "market-listing-controls"
                                                ]
                                              }
                                            >
                                              <label
                                                className={
                                                  styles["market-quantity"]
                                                }
                                              >
                                                Asking price per item
                                                <input
                                                  type="number"
                                                  min="1"
                                                  step="1"
                                                  value={listingPrice}
                                                  disabled={marketTradePending}
                                                  onChange={event => {
                                                    const price =
                                                      Number.parseInt(
                                                        event.currentTarget
                                                          .value,
                                                        10
                                                      );
                                                    setMarketSellPrices(
                                                      prices => ({
                                                        ...prices,
                                                        [item.itemKey]:
                                                          Number.isNaN(price)
                                                            ? 1
                                                            : Math.max(1, price)
                                                      })
                                                    );
                                                  }}
                                                />
                                              </label>
                                              <span>
                                                Suggested:{" "}
                                                {formatShekels(
                                                  item.playerMarket
                                                    .suggestedSellPrice
                                                )}
                                              </span>
                                              <button
                                                disabled={
                                                  marketTradePending ||
                                                  !item.playerMarket
                                                    .canCreateSellOrder ||
                                                  reserveBlocked || storedQuantity <
                                                    marketQuantity
                                                }
                                                onClick={() => {
                                                  void createMarketSellOrder(
                                                    item.itemKey,
                                                    listingPrice,
                                                    marketQuantity
                                                  );
                                                }}
                                              >
                                                {reserveBlocked ? BARLEY_RESERVE_MESSAGE : !item.playerMarket
                                                  .canCreateSellOrder
                                                  ? "Player listings unavailable"
                                                  : storedQuantity <
                                                      marketQuantity
                                                    ? `Not enough stored ${item.label.toLowerCase()}`
                                                    : `Create sell listing: ${marketQuantity} for ${formatShekels(
                                                        listingPrice
                                                      )} each`}
                                              </button>
                                            </div>
                                          )}
                                          <MarketListings
                                            key={`${action}:${item.itemKey}`}
                                            stock={storedQuantity}
                                            itemKey={item.itemKey}
                                            action={
                                              action === "sell" ? "sell" : "buy"
                                            }
                                            quantity={marketQuantity}
                                            availableStorage={availableStorage}
                                            balance={
                                              farmState.snapshot.player
                                                .shekelBalance
                                            }
                                            pending={marketTradePending}
                                            farmVersion={
                                              farmState.snapshot.farm.version
                                            }
                                            buy={(orderId, unitPrice) =>
                                              buyPlayerListing(
                                                orderId,
                                                unitPrice,
                                                marketQuantity
                                              )
                                            }
                                            cancel={cancelMarketSellOrder}
                                          />
                                        </>
                                      )}
                                    </section>
                                  );
                                })}
                            </Tabs.Content>
                          ))}
                        </Tabs.Root>
                      </Tabs.Content>
                    ))}
                  </Tabs.Root>
                  {marketTradeError !== null && (
                    <p className={styles["market-error"]} role="alert">
                      {marketTradeError}
                    </p>
                  )}
                </div>
              ) : marketQuoteState.type === "failed" ? (
                <div>
                  <p role="alert">{marketQuoteState.reason}</p>
                  <button
                    onClick={() => {
                      setMarketQuoteState({ type: "loading" });
                      setMarketQuoteRefresh(refresh => refresh + 1);
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <p>
                  {farmState.type === "ready"
                    ? "Loading market prices…"
                    : "Farm resources are loading…"}
                </p>
              )}
              {isOpenMarketDialog && (
                <MarketTradeHistory
                  key={marketScope}
                  refresh={marketQuoteRefresh}
                  scope={marketScope}
                />
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
  );
}
