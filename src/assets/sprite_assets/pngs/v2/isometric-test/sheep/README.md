# Approved pen artwork

Both empty pen sprites and automatic road-facing placement were approved by the
player on November 15, 2026. The temporary placement controls have been removed.
Keep these source sprites for the future production implementation.

- `sheep-pen-empty-test.png`: near lower-left gate; mirror for lower-right.
- `sheep-pen-empty-rear-test.png`: far upper-left gate; mirror for upper-right.
- Use the existing building texture preparation (256 maximum size, 0.35 sharpening,
  linear filtering), retaining the complete source canvas.
- Approved display size: 196 × 196 world pixels. Origin: (0.5, 0.565).
- Anchor at `isoPoint({ column: origin.column + 0.5, row: origin.row + 0.5 })`.
  This registers the pillar bases within the 192 × 96 ground footprint, including
  at map edges. Do not return to the oversized 232-pixel preview.
- A loading road with column less than the plot origin selects rear/unmirrored;
  row less than the origin selects rear/mirrored. Column at least origin + 2
  selects front/mirrored; the remaining lower edge selects front/unmirrored.
- Reuse completed connected-road and ordinary-ground placement validation.

No pen or sheep gameplay has been enabled by this artwork approval.
