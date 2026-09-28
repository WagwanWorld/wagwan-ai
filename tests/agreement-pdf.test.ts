import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfText: string[] = [];

vi.mock('jspdf', () => ({
  default: class MockJsPDF {
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    line() {}
    addPage() {}
    addImage() {}
    save() {}
    splitTextToSize(text: string) {
      return [text];
    }
    text(value: string | string[]) {
      if (Array.isArray(value)) {
        pdfText.push(...value);
      } else {
        pdfText.push(value);
      }
    }
  },
}));

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfText.length = 0;
  });

  it('does not add material clauses absent from the visible signing agreement', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Jane Doe',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '28 September 2026',
    });

    const text = pdfText.join('\n');

    expect(text).toContain('Failure to pay within this period allows suspension');
    expect(text).not.toContain('During the grace period, services shall continue uninterrupted.');
    expect(text).not.toContain('Reinstatement shall not waive');
    expect(text).not.toContain('fees materially changed mid-term');
    expect(text).not.toContain('liability cap is based on actual commissions');
    expect(text).not.toContain('This limitation applies to all claims');
    expect(text).not.toContain('The affected Party shall promptly notify');
    expect(text).not.toContain('appointment shall follow Section 11');
  });
});
