import type { ParsedCreatorRow } from './sheetParser';

type ExistingRosterRow = {
  brand_id: string;
  ig_username: string;
};

export function splitRowsByExistingRoster(
  rows: ParsedCreatorRow[],
  existingRows: ExistingRosterRow[],
  brandId: string,
): { toProcess: ParsedCreatorRow[]; alreadyInRoster: number } {
  const existingSet = new Set(
    existingRows
      .filter((row) => row.brand_id === brandId)
      .map((row) => row.ig_username.toLowerCase()),
  );

  const toProcess: ParsedCreatorRow[] = [];
  let alreadyInRoster = 0;

  for (const row of rows) {
    if (existingSet.has(row.handle.toLowerCase())) {
      alreadyInRoster++;
    } else {
      toProcess.push(row);
    }
  }

  return { toProcess, alreadyInRoster };
}
