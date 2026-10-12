import type { FarmCoordinate } from "../../../game-core/farm/irrigation";

export type IsoCell = FarmCoordinate;
export const ISO_WIDTH = 96;
export const ISO_HEIGHT = 48;
/** World-space projection only. Camera zoom/pan must be removed before picking. */
export const isoPoint = ({ column, row }: IsoCell) => ({ x: (column - row) * ISO_WIDTH / 2, y: (column + row) * ISO_HEIGHT / 2 });
export const isoCell = (x: number, y: number): IsoCell => ({ column: Math.round(x / ISO_WIDTH + y / ISO_HEIGHT), row: Math.round(y / ISO_HEIGHT - x / ISO_WIDTH) });
export const footprintContains = (origin: IsoCell, columns: number, rows: number, cell: IsoCell) =>
  cell.column >= origin.column && cell.column < origin.column + columns && cell.row >= origin.row && cell.row < origin.row + rows;
export const footprintFront = (origin: IsoCell, columns: number, rows: number) =>
  isoPoint({ column: origin.column + columns - 0.5, row: origin.row + rows - 0.5 });
