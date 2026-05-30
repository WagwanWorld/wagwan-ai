import * as XLSX from 'xlsx';

/* ── Column mapping ────────────────────────────────────────── */

const COLUMN_MAP: Record<string, string[]> = {
  handle: ['instagram', 'handle', 'ig_username', 'ig_handle', 'ig', '@', 'username'],
  display_name: ['name', 'display_name', 'full_name', 'creator_name'],
  email: ['email', 'email_address', 'mail'],
  phone: ['phone', 'phone_number', 'mobile', 'contact'],
  rates: ['rate', 'rates', 'price', 'cost', 'fee'],
  notes: ['notes', 'note', 'comments', 'remarks'],
  tags: ['tags', 'tag', 'category', 'categories', 'type'],
  location: ['location', 'city', 'region', 'geo'],
};

/** Known field keys (everything mapped above). */
const KNOWN_FIELDS = new Set(Object.keys(COLUMN_MAP));

export type ParsedCreatorRow = {
  /** Row number in the original file (1-based, excluding header). */
  row: number;
  handle: string;
  display_name?: string;
  email?: string;
  phone?: string;
  rates?: string;
  notes?: string;
  tags?: string;
  location?: string;
  /** All columns that didn't match a known field. */
  custom_fields: Record<string, string>;
};

export type SheetValidationResult = {
  valid: ParsedCreatorRow[];
  errors: Array<{ row: number; reason: string }>;
  skipped_no_handle: number;
  duplicates_in_file: number;
  total_rows: number;
};

/* ── Parsing ───────────────────────────────────────────────── */

/**
 * Parse a CSV or XLSX file buffer into raw row objects.
 * Returns an array of { header → value } records.
 */
export function parseSheetBuffer(buffer: ArrayBuffer, filename: string): Record<string, string>[] {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
    throw new Error('Unsupported file type. Upload a .csv or .xlsx file.');
  }

  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('File contains no sheets.');

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: '',
    raw: false,
  });

  return rows.map((r) => {
    const out: Record<string, string> = {};
    for (const [key, val] of Object.entries(r)) {
      out[key] = String(val ?? '').trim();
    }
    return out;
  });
}

/* ── Column detection ──────────────────────────────────────── */

/**
 * Build a mapping from the file's actual header names to our known field keys.
 * Returns { fileHeader → knownField } for matched columns.
 */
function detectColumns(headers: string[]): Map<string, string> {
  const mapping = new Map<string, string>();
  const used = new Set<string>();

  for (const header of headers) {
    const norm = header.toLowerCase().replace(/[^a-z0-9@]/g, '');
    for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
      if (used.has(field)) continue;
      if (aliases.some((a) => norm === a.replace(/[^a-z0-9@]/g, ''))) {
        mapping.set(header, field);
        used.add(field);
        break;
      }
    }
  }

  return mapping;
}

/* ── Handle cleaning ───────────────────────────────────────── */

function cleanHandle(raw: string): string {
  let h = raw.trim();
  // Strip URL prefixes
  h = h.replace(/^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\//i, '');
  // Strip trailing path segments (e.g. /reels, /tagged)
  h = h.split('/')[0] || h;
  // Strip query params
  h = h.split('?')[0] || h;
  // Strip leading @
  h = h.replace(/^@/, '');
  return h.toLowerCase().trim();
}

/* ── Validate & transform ──────────────────────────────────── */

/**
 * Parse a file buffer, detect columns, clean handles, deduplicate,
 * and return validated rows ready for processing.
 */
export function parseAndValidate(buffer: ArrayBuffer, filename: string): SheetValidationResult {
  const rawRows = parseSheetBuffer(buffer, filename);
  if (rawRows.length === 0) {
    return { valid: [], errors: [], skipped_no_handle: 0, duplicates_in_file: 0, total_rows: 0 };
  }

  const headers = Object.keys(rawRows[0]);
  const colMap = detectColumns(headers);

  // Find the handle column
  let handleHeader: string | null = null;
  for (const [fileHeader, field] of colMap.entries()) {
    if (field === 'handle') {
      handleHeader = fileHeader;
      break;
    }
  }

  const valid: ParsedCreatorRow[] = [];
  const errors: Array<{ row: number; reason: string }> = [];
  const seenHandles = new Set<string>();
  let skippedNoHandle = 0;
  let duplicates = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i + 2; // 1-based, skip header row

    // Extract handle
    const rawHandle = handleHeader ? raw[handleHeader] : '';
    if (!rawHandle) {
      skippedNoHandle++;
      errors.push({ row: rowNum, reason: 'Missing Instagram handle' });
      continue;
    }

    const handle = cleanHandle(rawHandle);
    if (!handle) {
      skippedNoHandle++;
      errors.push({ row: rowNum, reason: 'Invalid Instagram handle' });
      continue;
    }

    if (seenHandles.has(handle)) {
      duplicates++;
      continue;
    }
    seenHandles.add(handle);

    // Map known fields
    const parsed: ParsedCreatorRow = { row: rowNum, handle, custom_fields: {} };
    for (const [fileHeader, value] of Object.entries(raw)) {
      if (!value) continue;
      const knownField = colMap.get(fileHeader);
      if (knownField && knownField !== 'handle') {
        (parsed as Record<string, unknown>)[knownField] = value;
      } else if (!knownField) {
        // Unrecognized column → custom field
        parsed.custom_fields[fileHeader] = value;
      }
    }

    valid.push(parsed);
  }

  return {
    valid,
    errors,
    skipped_no_handle: skippedNoHandle,
    duplicates_in_file: duplicates,
    total_rows: rawRows.length,
  };
}
