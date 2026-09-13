import { createStore } from "zustand/vanilla";

type State = {
  readonly isOpen: boolean;
  readonly openMarket: () => void;
  readonly setOpen: (isOpen: boolean) => void;
};

export const marketUiStore = createStore<State>()(set => ({
  isOpen: false,

  openMarket: () => {
    set({ isOpen: true });
  },

  setOpen: isOpen => {
    set({ isOpen });
  }
}));
