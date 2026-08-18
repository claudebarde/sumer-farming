export const FARM_SPRITES = {
  // ============================================================
  // TERRAIN — TOP ROW
  // ============================================================

  ground: {
    x: 6,
    y: 6,
    width: 161,
    height: 162
  },

  groundVariant: {
    x: 168,
    y: 6,
    width: 158,
    height: 162
  },

  canalHorizontal: {
    x: 326,
    y: 6,
    width: 163,
    height: 162
  },

  canalVertical: {
    x: 490,
    y: 6,
    width: 164,
    height: 162
  },

  canalCorner: {
    x: 654,
    y: 6,
    width: 161,
    height: 162
  },

  canalCross: {
    x: 817,
    y: 6,
    width: 160,
    height: 162
  },

  canalTJunction: {
    x: 979,
    y: 6,
    width: 159,
    height: 162
  },

  water: {
    x: 1139,
    y: 6,
    width: 161,
    height: 162
  },

  groundPathHorizontal: {
    x: 1301,
    y: 6,
    width: 173,
    height: 162
  },

  groundFence: {
    x: 1475,
    y: 6,
    width: 167,
    height: 162
  },

  // ============================================================
  // CROPS — SECOND ROW
  // ============================================================

  barleySeeded: {
    x: 6,
    y: 170,
    width: 161,
    height: 176
  },

  barleyGrowing: {
    x: 168,
    y: 170,
    width: 158,
    height: 176
  },

  barleyReady: {
    x: 326,
    y: 170,
    width: 163,
    height: 176
  },

  harvestedBarley: {
    x: 510,
    y: 170,
    width: 144,
    height: 168
  },

  // ============================================================
  // FARMER IDLE
  // ============================================================

  farmerIdle0: {
    x: 674,
    y: 170,
    width: 142,
    height: 176
  },

  farmerIdle1: {
    x: 853,
    y: 170,
    width: 125,
    height: 176
  },

  farmerIdle2: {
    x: 978,
    y: 170,
    width: 105,
    height: 175
  },

  farmerIdle3: {
    x: 1083,
    y: 170,
    width: 109,
    height: 176
  },

  farmerIdle4: {
    x: 1192,
    y: 170,
    width: 111,
    height: 176
  },

  farmerIdle5: {
    x: 1318,
    y: 171,
    width: 77,
    height: 174
  },

  // ============================================================
  // FARMER WALK
  // ============================================================

  farmerWalk0: {
    x: 29,
    y: 364,
    width: 109,
    height: 146
  },

  farmerWalk1: {
    x: 153,
    y: 364,
    width: 84,
    height: 135
  },

  farmerWalk2: {
    x: 286,
    y: 353,
    width: 98,
    height: 156
  },

  farmerWalk3: {
    x: 400,
    y: 358,
    width: 99,
    height: 143
  },

  // ============================================================
  // FARMER PLANT / WORK
  // ============================================================

  farmerPlant0: {
    x: 516,
    y: 364,
    width: 138,
    height: 143
  },

  farmerPlant1: {
    x: 678,
    y: 374,
    width: 109,
    height: 108
  },

  farmerPlant2: {
    x: 833,
    y: 377,
    width: 125,
    height: 104
  },

  farmerPlant3: {
    x: 973,
    y: 353,
    width: 117,
    height: 129
  },

  // ============================================================
  // FARMER HARVEST
  // ============================================================

  farmerHarvest0: {
    x: 26,
    y: 516,
    width: 108,
    height: 144
  },

  farmerHarvest1: {
    x: 142,
    y: 535,
    width: 125,
    height: 121
  },

  farmerHarvest2: {
    x: 294,
    y: 522,
    width: 79,
    height: 138
  },

  farmerHarvest3: {
    x: 418,
    y: 521,
    width: 88,
    height: 141
  },

  // ============================================================
  // BUILDING / VEGETATION
  // ============================================================

  farm: {
    x: 509,
    y: 512,
    width: 363,
    height: 303
  },

  palmTree: {
    x: 874,
    y: 513,
    width: 161,
    height: 197
  },

  bush: {
    x: 1052,
    y: 588,
    width: 143,
    height: 122
  },

  reeds: {
    x: 1214,
    y: 536,
    width: 136,
    height: 174
  },

  // ============================================================
  // PROPS
  // ============================================================

  rocks: {
    x: 23,
    y: 678,
    width: 158,
    height: 128
  },

  fence: {
    x: 200,
    y: 666,
    width: 185,
    height: 214
  },

  signpost: {
    x: 407,
    y: 664,
    width: 99,
    height: 216
  }
} as const;

export type FarmSpriteName = keyof typeof FARM_SPRITES;

export const spriteName = <Name extends FarmSpriteName>(name: Name): Name =>
  name;
