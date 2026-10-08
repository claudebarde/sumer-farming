import { createStore } from "zustand/vanilla";
import type { SumerCityId } from "../../game-data/sumer";
import type { Residence } from "../../schemas/residence";

// Browsing a city is deliberately separate from persistent residence.
export const sumerMapStore = createStore<{
  selectedCity: SumerCityId | null;
  residence: Residence | null;
  selectCity: (city: SumerCityId) => void;
}>()(set => ({ selectedCity: null, residence: null, selectCity: selectedCity => set({ selectedCity }) }));
