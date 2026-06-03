export const MAX_AGREEMENT_NAME_LENGTH = 160;
export const MAX_AGREEMENT_COMPANY_LENGTH = 200;
export const MAX_SIGNATURE_BYTES = 512 * 1024;

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export type ValidAgreementSubmission = {
  name: string;
  company: string;
  signature: string;
};

export type AgreementValidationResult =
  | { ok: true; value: ValidAgreementSubmission }
  | { ok: false; message: string };

function decodedBase64Length(base64: string): number | null {
  if (!base64 || base64.length % 4 === 1 || !BASE64_RE.test(base64)) {
    return null;
  }

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function validateAgreementSubmission(
  rawName: FormDataEntryValue | null,
  rawCompany: FormDataEntryValue | null,
  rawSignature: FormDataEntryValue | null,
): AgreementValidationResult {
  const name = rawName?.toString().trim() ?? '';
  const company = rawCompany?.toString().trim() ?? '';
  const signature = rawSignature?.toString() ?? '';

  if (!name || !company || !signature) {
    return {
      ok: false,
      message: 'Please fill in your name, company name, and provide your signature.',
    };
  }

  if (name.length > MAX_AGREEMENT_NAME_LENGTH || company.length > MAX_AGREEMENT_COMPANY_LENGTH) {
    return { ok: false, message: 'Name or company name is too long.' };
  }

  if (!signature.startsWith(PNG_DATA_URL_PREFIX)) {
    return { ok: false, message: 'Please provide a valid signature.' };
  }

  const encodedSignature = signature.slice(PNG_DATA_URL_PREFIX.length);
  const decodedLength = decodedBase64Length(encodedSignature);
  if (decodedLength === null || decodedLength > MAX_SIGNATURE_BYTES) {
    return { ok: false, message: 'Please provide a valid signature.' };
  }

  return { ok: true, value: { name, company, signature } };
}
