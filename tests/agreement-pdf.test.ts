import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfState = vi.hoisted(() => ({
  texts: [] as string[],
  savedFiles: [] as string[],
}));

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    addImage: vi.fn(),
    addPage: vi.fn(),
    line: vi.fn(),
    save: vi.fn((fileName: string) => pdfState.savedFiles.push(fileName)),
    setDrawColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    text: vi.fn((text: string | string[]) => {
      pdfState.texts.push(Array.isArray(text) ? text.join('\n') : text);
    }),
  })),
}));

import { generateAgreementPdf } from '../src/lib/utils/agreementPdf';

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfState.texts = [];
    pdfState.savedFiles = [];
  });

  it('does not include legal clauses hidden from the signing page', () => {
    generateAgreementPdf({
      signerName: 'Riya Shah',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '25 September 2026',
    });

    const text = pdfState.texts.join('\n');

    expect(text).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(text).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );
    expect(text).not.toContain('services shall continue uninterrupted');
    expect(text).not.toContain('interest or penalties');
    expect(text).not.toContain('Either Party may terminate immediately');
    expect(text).not.toContain('The liability cap is based on actual commissions');
    expect(text).not.toContain('Section 11 of the Act');
    expect(text).not.toContain('Each Party shall remain individually responsible');
  });
});
