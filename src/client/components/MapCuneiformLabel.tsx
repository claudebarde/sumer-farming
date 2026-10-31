// Approved title labels. Unconfigured titles intentionally render nothing.
const labels: Readonly<Record<string, string>> = {
  Road: "𒆜",
  Ground: "𒅖",
  "Arable ground": "𒄒",
  Barley: "𒊺",
  Sesame: "𒄑𒉌",
  Farm: "𒂍",
  Granary: "𒉌𒁾",
  Warehouse: "𒂍𒍑𒁍𒁕",
  Mill: "𒂍𒄯",
  Brewery: "𒂍𒋆",
  "Bread oven": "𒌅𒊒𒈾",
  River: "𒀀𒇉",
  "Irrigation canal": "𒉽𒂊",
  Farmer: "𒀳",
  "Barley market": "𒆠𒇴𒊺𒀀",
  "Beer market": "𒆠𒇴𒁉𒀀",
  "Baking market": "𒆠𒇴𒃻𒀀",
  Market: "𒆠𒇴",
  Reeds: "𒄀",
  Rocks: "𒎎",
  Bush: "𒄉",
  "Date palm": "𒊷",
  "Merchant boat": "𒈣 𒁮𒃼𒀀"
};

export default function MapCuneiformLabel({ element }: { element: string }) {
  const label = labels[element];
  return label ? (
    <span className="cuneiforms" aria-hidden="true">
      {label}
    </span>
  ) : null;
}
