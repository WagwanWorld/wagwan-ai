import { describe, expect, it, vi } from 'vitest';

const textCalls: string[] = [];
const saveMock = vi.fn();

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    addImage: vi.fn(),
    addPage: vi.fn(),
    line: vi.fn(),
    save: saveMock,
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
}));

describe('generateAgreementPdf', () => {
  it('does not add legal clauses that are absent from the visible agreement', async () => {
    textCalls.length = 0;
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Jane Doe',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '22 September 2026',
    });

    const pdfText = textCalls.join('\n');
    expect(pdfText).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(pdfText).not.toContain('Reinstatement shall not waive');
    expect(pdfText).not.toContain('Platform services are discontinued or fees materially changed');
    expect(pdfText).not.toContain('Each Party shall remain individually responsible');
    expect(pdfText).not.toContain('appointment shall follow Section 11');
    expect(pdfText).toContain(
      'Failure to pay within this period allows suspension of Platform access',
    );
    expect(saveMock).toHaveBeenCalledWith('Service Agreement Fuzone.pdf');
  });
});
