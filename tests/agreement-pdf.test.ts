import { beforeEach, describe, expect, it, vi } from 'vitest';

const textCalls: string[] = [];

vi.mock('jspdf', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      addImage: vi.fn(),
      addPage: vi.fn(),
      line: vi.fn(),
      save: vi.fn(),
      setDrawColor: vi.fn(),
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      splitTextToSize: vi.fn((text: string) => [text]),
      text: vi.fn((text: string | string[]) => {
        if (Array.isArray(text)) {
          textCalls.push(...text);
        } else {
          textCalls.push(text);
        }
      }),
    })),
  };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    textCalls.length = 0;
  });

  it('does not add material legal clauses that are absent from the signed agreement page', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Jane Client',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '18 August 2026',
    });

    const pdfText = textCalls.join('\n');

    expect(pdfText).toContain('5.5. In the event of payment default');
    expect(pdfText).toContain('Failure to pay within this period allows suspension');
    expect(pdfText).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(pdfText).not.toContain('Reinstatement shall not waive');
    expect(pdfText).not.toContain('Either Party may terminate immediately');
    expect(pdfText).not.toContain('Section 11 of the Act');
    expect(pdfText).not.toContain('This limitation applies to all claims');
  });
});
