import { createStore } from "zustand/vanilla";
export const levelUiStore = createStore<{ isOpen: boolean; setOpen: (isOpen: boolean) => void }>()(set => ({
  isOpen: false, setOpen: isOpen => set({ isOpen })
}));
