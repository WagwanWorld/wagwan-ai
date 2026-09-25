import type { ParsedCreatorRow } from './sheetParser';

type ExistingRosterHandle = {
  brand_id: string | null;
  ig_username: string | null;
};

export function splitRowsByBrandRoster(
  validRows: ParsedCreatorRow[],
  existingRows: ExistingRosterHandle[],
  brandId: string,
): { toProcess: ParsedCreatorRow[]; alreadyInRoster: number } {
  const existingHandles = new Set(
    existingRows
      .filter((row) => row.brand_id === brandId)
      .map((row) => row.ig_username?.trim().toLowerCase())
      .filter((handle): handle is string => Boolean(handle)),
  );

  const toProcess: ParsedCreatorRow[] = [];
  let alreadyInRoster = 0;

  for (const row of validRows) {
    if (existingHandles.has(row.handle)) {
      alreadyInRoster++;
    } else {
      toProcess.push(row);
    }
  }

  return { toProcess, alreadyInRoster };
}
