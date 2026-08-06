import type { ParsedCreatorRow } from './sheetParser';

type ExistingRosterRow = {
  brand_id: string | null;
  ig_username: string | null;
};

export function splitRowsByBrandRoster(
  rows: ParsedCreatorRow[],
  existingRows: ExistingRosterRow[],
  brandId: string,
): { alreadyInRoster: number; toProcess: ParsedCreatorRow[] } {
  const existingSet = new Set(
    existingRows
      .filter((row) => row.brand_id === brandId && row.ig_username)
      .map((row) => String(row.ig_username)),
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

  return { alreadyInRoster, toProcess };
}
