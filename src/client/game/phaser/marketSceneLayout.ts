export const marketSceneLayout = (columns: number) => {
  const left = Math.max(3, Math.floor(columns / 2) - 2);
  return { left, right: left + 4, top: 3, bottom: 7, roadRow: 5,
    farm: { column: 0, row: 3 },
    farmer: { column: 1, row: 5 },
    stands: [
      { column: left + 1, row: 1 },
      { column: left + 1, row: 4 },
      { column: left + 1, row: 8 }
    ] } as const;
};
