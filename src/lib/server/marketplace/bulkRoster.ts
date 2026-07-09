import type { ParsedCreatorRow } from './sheetParser';

export type ExistingRosterHandleRow = {
  brand_id: string | null;
  ig_username: string | null;
};

export function splitRowsByExistingBrandRoster(
  rows: ParsedCreatorRow[],
  existingRows: ExistingRosterHandleRow[],
  brandId: string,
): { toProcess: ParsedCreatorRow[]; alreadyInRoster: number } {
  const existingHandles = new Set(
    existingRows
      .filter((row) => row.brand_id === brandId)
      .map((row) => row.ig_username?.toLowerCase().trim())
      .filter((handle): handle is string => Boolean(handle)),
  );

  const toProcess: ParsedCreatorRow[] = [];
  let alreadyInRoster = 0;

  for (const row of rows) {
    if (existingHandles.has(row.handle)) {
      alreadyInRoster++;
    } else {
      toProcess.push(row);
    }
  }

  return { toProcess, alreadyInRoster };
}
