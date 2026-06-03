import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  MAX_SIGNATURE_BYTES,
  validateAgreementSubmission,
} from '../src/lib/server/agreementValidation';

describe('validateAgreementSubmission', () => {
  it('accepts a bounded PNG signature data URL and trims names', () => {
    const result = validateAgreementSubmission(
      '  Test Signer  ',
      '  Test Company  ',
      'data:image/png;base64,iVBORw0KGgo=',
    );

    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Test Signer',
        company: 'Test Company',
        signature: 'data:image/png;base64,iVBORw0KGgo=',
      },
    });
  });

  it('rejects non-PNG signature payloads', () => {
    const result = validateAgreementSubmission('Test Signer', 'Test Company', 'not-a-data-url');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('Please provide a valid signature.');
  });

  it('rejects oversized signature payloads before storage', () => {
    const oversizedSignature = `data:image/png;base64,${Buffer.alloc(
      MAX_SIGNATURE_BYTES + 1,
    ).toString('base64')}`;

    const result = validateAgreementSubmission('Test Signer', 'Test Company', oversizedSignature);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('Please provide a valid signature.');
  });
});
