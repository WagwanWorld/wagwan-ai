import { describe, expect, it, vi, beforeEach } from 'vitest';

const pdfState = vi.hoisted(() => ({
  texts: [] as string[],
}));

vi.mock('jspdf', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      setDrawColor: vi.fn(),
      line: vi.fn(),
      addPage: vi.fn(),
      addImage: vi.fn(),
      save: vi.fn(),
      splitTextToSize: vi.fn((text: string) => [text]),
      text: vi.fn((text: string | string[]) => {
        if (Array.isArray(text)) pdfState.texts.push(...text);
        else pdfState.texts.push(text);
      }),
    })),
  };
});

import { generateAgreementPdf } from '../src/lib/utils/agreementPdf';

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfState.texts = [];
  });

  it('does not include hidden clauses absent from the signing page', () => {
    generateAgreementPdf({
      signerName: 'Test Signer',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '7 August 2026',
    });

    const pdfText = pdfState.texts.join('\n');
    expect(pdfText).toContain('5.6. Upon receipt of all outstanding payments');
    expect(pdfText).not.toContain('5.7. During the grace period');
    expect(pdfText).not.toContain("Reinstatement shall not waive");
    expect(pdfText).not.toContain('penalty fees');
    expect(pdfText).not.toContain('does not extend to the ticket price');
    expect(pdfText).not.toContain('Platform services are discontinued');
    expect(pdfText).not.toContain('actual commissions and subscription revenues');
    expect(pdfText).not.toContain('The affected Party shall promptly notify');
    expect(pdfText).not.toContain('appointment shall follow Section 11');
  });
});
