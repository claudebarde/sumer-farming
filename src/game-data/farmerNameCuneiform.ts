import { FEMALE_FARMER_NAMES, MALE_FARMER_NAMES } from "./farmerNames";

type FarmerName =
  | (typeof MALE_FARMER_NAMES)[number]
  | (typeof FEMALE_FARMER_NAMES)[number];

// Fill in each translation here. Empty entries are hidden in the interface.
export const FARMER_NAME_CUNEIFORM: Readonly<Record<FarmerName, string>> = {
  Gudea: "𒅗𒌤𒀀",
  "Ur-Nanshe": "𒌨𒀭𒀏",
  Meskalamdug: "𒈩𒌦𒄭",
  Lugalzagesi: "𒈗𒍠𒄀𒋛",
  "Amar-Suen": "𒀭𒀫𒀭𒂗𒍪",
  Baranamtara: "𒁈𒉆𒋻𒊏",
  "Geme-Bau": "𒊩𒆳𒀭𒁀𒌑",
  Enheduanna: "𒂗𒃶𒌌𒀭𒈾",
  "Geme-Ninlila": "𒊩𒆳𒀭𒎏𒆤𒇲",
  Ninkalla: "𒎐𒆗𒆷"
};

export const farmerNameCuneiform = (name: string): string =>
  Object.hasOwn(FARMER_NAME_CUNEIFORM, name)
    ? FARMER_NAME_CUNEIFORM[name as FarmerName]
    : "";
