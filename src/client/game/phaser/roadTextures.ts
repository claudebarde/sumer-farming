import { roadCrossTexture } from "./roadCrossTexture";

/** Rotate on the ground plane, preserving the 2:1 diamond rather than rotating the screen rectangle. */
const rotate = (source: HTMLCanvasElement, turns: number): HTMLCanvasElement => {
  const output = document.createElement("canvas");
  output.width = source.width; output.height = source.height;
  const context = output.getContext("2d")!;
  context.translate(output.width / 2, output.height / 2);
  context.scale(2, 1); context.rotate(turns * Math.PI / 2); context.scale(0.5, 1);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return output;
};
const rotateMask = (mask: number, turns: number) => ((mask << turns) | (mask >> (4 - turns))) & 15;

export const roadTextures = (straight: HTMLCanvasElement, corner: HTMLCanvasElement, junction: HTMLCanvasElement): Readonly<Record<number, HTMLCanvasElement>> => {
  // Form a simple end by replacing the straight road's SW branch with the corner's sandy SW quadrant.
  const end = roadCrossTexture(straight, corner);
  const textures: Record<number, HTMLCanvasElement> = { 0: end, 15: roadCrossTexture(junction, straight) };
  for (let turn = 0; turn < 4; turn++) {
    textures[rotateMask(2, turn)] = rotate(end, turn);
    textures[rotateMask(3, turn)] = rotate(corner, turn);
    textures[rotateMask(7, turn)] = rotate(junction, turn);
  }
  textures[10] = straight;
  const mirrored = document.createElement("canvas");
  mirrored.width = straight.width; mirrored.height = straight.height;
  const context = mirrored.getContext("2d")!;
  context.translate(mirrored.width, 0); context.scale(-1, 1); context.drawImage(straight, 0, 0);
  textures[5] = mirrored;
  return textures;
};
