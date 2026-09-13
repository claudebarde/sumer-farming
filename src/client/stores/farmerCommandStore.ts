import { createStore } from "zustand/vanilla";
import { match } from "ts-pattern";
import type {
  Tile,
  TilePosition,
  Crop,
  Build,
  InteractiveObject
} from "../game/phaser/types";
import type { InventoryItemKey } from "../../game-data/inventoryItems";
import { FARMER_CARRY_CAPACITY } from "../../game-data/storage";
import type { GatherableResourceKey } from "../../game-data/resources";

export type FarmerCommand =
  | {
      readonly id: string;
      readonly type: "build";
      readonly target: TilePosition;
      readonly build: Build;
    }
  | {
      readonly id: string;
      readonly type: "destroy";
      readonly target: TilePosition;
      readonly build: "irrigation";
    }
  | {
      readonly id: string;
      readonly type: "harvest";
      readonly target: TilePosition;
    }
  | {
      readonly id: string;
      readonly type: "gather";
      readonly target: TilePosition;
      readonly item: GatherableResourceKey;
    }
  | {
      readonly id: string;
      readonly type: "inspect";
      readonly target: Tile;
    }
  | {
      readonly id: string;
      readonly type: "move";
      readonly target: TilePosition;
    }
  | {
      readonly id: string;
      readonly type: "pickup";
      readonly target: TilePosition;
      readonly item: InteractiveObject;
    }
  | {
      readonly id: string;
      readonly type: "drop";
      readonly target: TilePosition;
    }
  | {
      readonly id: string;
      readonly type: "deposit";
      readonly target: TilePosition;
      readonly storage: "farm" | "granary";
    }
  | {
      readonly id: string;
      readonly type: "withdraw";
      readonly target: TilePosition;
      readonly item: InventoryItemKey;
      readonly storage: "farm" | "granary";
    }
  | {
      readonly id: string;
      readonly type: "plant";
      readonly target: TilePosition;
      readonly crop: Crop;
    };

type WithoutId<T extends { readonly id: string }> = T extends unknown
  ? Omit<T, "id">
  : never;

export type FarmerCommandInput = WithoutId<FarmerCommand>;
export type CarriedItem = {
  readonly itemKey: InventoryItemKey;
  readonly quantity: number;
  readonly expiresAt: string | null;
} | null;

export type FarmerStatus =
  | { readonly type: "idle" }
  | { readonly type: "moving"; readonly commandId: string }
  | { readonly type: "building"; readonly commandId: string }
  | { readonly type: "destroying"; readonly commandId: string }
  | { readonly type: "planting"; readonly commandId: string }
  | { readonly type: "harvesting"; readonly commandId: string }
  | { readonly type: "gathering"; readonly commandId: string }
  | { readonly type: "inspecting"; readonly commandId: string }
  | { readonly type: "pickingUp"; readonly commandId: string }
  | { readonly type: "dropping"; readonly commandId: string }
  | { readonly type: "depositing"; readonly commandId: string }
  | { readonly type: "withdrawing"; readonly commandId: string }
  | {
      readonly type: "failed";
      readonly commandId: string;
      readonly reason: string;
    };

type State = {
  readonly commands: readonly FarmerCommand[];
  readonly status: FarmerStatus;
  readonly carriedItem: CarriedItem;
  readonly setStatus: (status: FarmerStatus) => void;
  readonly setCarriedItem: (carriedItem: CarriedItem) => void;
  readonly addCommand: (command: FarmerCommandInput) => void;
  readonly removeCommand: (commandId: string) => void;
};

export const farmerCommandStore = createStore<State>()(set => ({
  commands: [],
  status: { type: "idle" },
  carriedItem: null,

  setStatus: (status: FarmerStatus) => set({ status }),
  setCarriedItem: (carriedItem: CarriedItem) => set({ carriedItem }),

  addCommand: command =>
    set(state => {
      if (command.type === "pickup" && state.carriedItem !== null) {
        if (
          state.carriedItem.itemKey !== command.item ||
          state.carriedItem.quantity >= FARMER_CARRY_CAPACITY
        ) {
          return {};
        }
      }

      if (
        (command.type === "drop" || command.type === "deposit") &&
        state.carriedItem === null
      ) {
        return {};
      }

      if (
        command.type === "plant" &&
        state.carriedItem?.itemKey !== command.crop
      ) {
        return {};
      }

      if (command.type === "harvest" && state.carriedItem !== null) {
        return {};
      }

      if (command.type === "gather" && state.carriedItem !== null) {
        return {};
      }

      if (command.type === "withdraw" && state.carriedItem !== null) {
        return {};
      }

      const newCommand: FarmerCommand = {
        ...command,
        id: crypto.randomUUID()
      };

      return { commands: [...state.commands, newCommand] };
    }),

  removeCommand: (commandId: string) =>
    set(state => {
      const newCommands = state.commands.filter(
        command => command.id !== commandId
      );
      // when a command is removed, the next status is calculated
      // if there is another command in the array of commands, the status is calculated from that command
      // if the array is emty, the status becomes "idle"
      const newStatus: FarmerStatus =
        newCommands.length === 0
          ? { type: "idle" }
          : match(newCommands[0])
              .returnType<FarmerStatus>()
              .with({ type: "move" }, () => ({
                type: "moving",
                commandId: newCommands[0].id
              }))
              .with({ type: "harvest" }, () => ({
                type: "harvesting",
                commandId: newCommands[0].id
              }))
              .with({ type: "gather" }, () => ({
                type: "gathering",
                commandId: newCommands[0].id
              }))
              .with({ type: "inspect" }, () => ({
                type: "inspecting",
                commandId: newCommands[0].id
              }))
              .with({ type: "plant" }, () => ({
                type: "planting",
                commandId: newCommands[0].id
              }))
              .with({ type: "build" }, () => ({
                type: "building",
                commandId: newCommands[0].id
              }))
              .with({ type: "destroy" }, () => ({
                type: "destroying",
                commandId: newCommands[0].id
              }))
              .with({ type: "pickup" }, () => ({
                type: "moving",
                commandId: newCommands[0].id
              }))
              .with({ type: "drop" }, () => ({
                type: "dropping",
                commandId: newCommands[0].id
              }))
              .with({ type: "deposit" }, () => ({
                type: "depositing",
                commandId: newCommands[0].id
              }))
              .with({ type: "withdraw" }, () => ({
                type: "withdrawing",
                commandId: newCommands[0].id
              }))
              .otherwise(() => ({ type: "idle" }));
      return { commands: newCommands, status: newStatus };
    })
}));
