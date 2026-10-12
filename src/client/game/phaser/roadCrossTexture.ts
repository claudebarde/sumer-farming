/** Fill the base tile's SW quadrant from another road tile.
 * Sources are already prepared at the same 2:1 resolution. No source PNG is changed.
 */
export const roadCrossTexture = (junction: HTMLCanvasElement, straight: HTMLCanvasElement): HTMLCanvasElement => {
  const output = document.createElement("canvas");
  output.width = junction.width; output.height = junction.height;
  const context = output.getContext("2d")!;
  context.drawImage(junction, 0, 0);
  context.save();
  context.beginPath();
  context.moveTo(output.width / 2, output.height / 2);
  context.lineTo(0, output.height / 2);
  context.lineTo(output.width / 2, output.height);
  context.closePath();
  context.clip();
  context.clearRect(0, 0, output.width, output.height);
  context.drawImage(straight, 0, 0, output.width, output.height);
  context.restore();
  return output;
};
