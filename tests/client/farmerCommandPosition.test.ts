import { describe, expect, it } from "vitest";
import { nearestTile } from "../../src/client/game/phaser/isometricProjection";
import { GameCommandSchema } from "../../src/schemas/gameCommands";

describe("farmer command positions between animation waypoints", () => {
  it.each([{column:2.38,row:5}, {column:-1.7,row:4.8}, {column:3,row:4}])("uses an integer tile without changing the visual pose %j", pose => {
    const original = {...pose};
    const farmerPosition = nearestTile(pose);
    const common = {farmerPosition, expectedFarmVersion:1};
    const commands = [
      {...common,type:"brewery_supply",action:"collect_water",target:{column:0,row:10}},
      {...common,type:"start_baking",buildingId:"00000000-0000-4000-8000-000000000001"},
      {...common,type:"start_milling",recipe:"flour",target:{column:4,row:3}},
      {...common,type:"start_batch_planting",targets:[{column:0,row:6}]},
      {...common,type:"build_road",target:{column:0,row:4}},
    ];
    for (const command of commands) expect(GameCommandSchema.safeParse(command).success).toBe(true);
    expect(pose).toEqual(original);
    expect(farmerPosition).not.toBe(pose);
  });
  it("keeps server validation strict for fractional target tiles", () => {
    expect(GameCommandSchema.safeParse({type:"brewery_supply",action:"collect_water",target:{column:0.4,row:10},farmerPosition:nearestTile({column:2.3,row:5}),expectedFarmVersion:1}).success).toBe(false);
  });
});
