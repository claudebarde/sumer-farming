/** Approved lifetime score, per completed action (never per output item). */
export const POINTS_RULE_VERSION = 1;
export const ACTION_POINTS = {
  sowBarley: 5, harvestBarley: 10, sowSesame: 5, harvestSesame: 20,
  plantPalm: 15, tendPalm: 5, harvestDates: 20, keepFish: 5,
  millFarmer: 30, millDonkey: 35, bakeBread: 40, brewBeer: 40,
  firstBuilding: 50, buildingUpgrade: 50, farmLevel: 100,
  treat: 5, shrineOffering: 10, merchantRequest: 50, zigguratStage: 25
} as const;
export type PointAction = keyof typeof ACTION_POINTS;
