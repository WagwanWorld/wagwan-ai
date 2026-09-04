import type { ParsedCreatorRow } from './sheetParser';

export type ExistingRosterHandle = {
  brand_id: string;
  ig_username: string;
};

export function splitRowsByBrandRoster(
  rows: ParsedCreatorRow[],
  existingRows: ExistingRosterHandle[],
  brandId: string,
): { toProcess: ParsedCreatorRow[]; alreadyInRoster: number } {
  const existingSet = new Set(
    existingRows.filter((row) => row.brand_id === brandId).map((row) => row.ig_username),
  );

  const toProcess: ParsedCreatorRow[] = [];
  let alreadyInRoster = 0;

  for (const row of rows) {
    if (existingSet.has(row.handle)) {
      alreadyInRoster++;
    } else {
      toProcess.push(row);
    }
  }

  return { toProcess, alreadyInRoster };
}
