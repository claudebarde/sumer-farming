import { createStore } from "zustand/vanilla";
import { match } from "ts-pattern";
import type {
  Tile,
  TilePosition,
  Crop,
  Build,
  InteractiveObject
} from "../types";

export type FarmerCommand =
  | {
      readonly id: string;
      readonly type: "build";
      readonly target: TilePosition;
      readonly build: Build;
    }
  | {
      readonly id: string;
      readonly type: "harvest";
      readonly target: TilePosition;
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
      readonly type: "plant";
      readonly target: TilePosition;
      readonly crop: Crop;
    };

type WithoutId<T extends { readonly id: string }> = T extends unknown
  ? Omit<T, "id">
  : never;

export type FarmerCommandInput = WithoutId<FarmerCommand>;

type FarmerStatus =
  | { readonly type: "idle" }
  | { readonly type: "moving"; readonly commandId: string }
  | { readonly type: "building"; readonly commandId: string }
  | { readonly type: "planting"; readonly commandId: string }
  | { readonly type: "harvesting"; readonly commandId: string }
  | { readonly type: "inspecting"; readonly commandId: string }
  | {
      readonly type: "failed";
      readonly commandId: string;
      readonly reason: string;
    };

type State = {
  readonly commands: readonly FarmerCommand[];
  readonly status: FarmerStatus;
  readonly setStatus: (status: FarmerStatus) => void;
  readonly addCommand: (command: FarmerCommandInput) => void;
  readonly removeCommand: (commandId: string) => void;
};

export const farmerCommandStore = createStore<State>()(set => ({
  commands: [],
  status: { type: "idle" },

  setStatus: (status: FarmerStatus) => set({ status }),

  addCommand: command =>
    set(state => {
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
              .with({ type: "pickup" }, () => ({
                type: "moving",
                commandId: newCommands[0].id
              }))
              .otherwise(() => ({ type: "idle" }));
      return { commands: newCommands, status: newStatus };
    })
}));
