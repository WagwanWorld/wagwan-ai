import { describe, expect, it, vi, beforeEach } from 'vitest';

const pdfTexts = vi.hoisted(() => [] as string[]);

vi.mock('jspdf', () => {
  return {
    default: class MockJsPdf {
      addPage() {}
      setFont() {}
      setFontSize() {}
      setTextColor() {}
      setDrawColor() {}
      line() {}
      addImage() {}
      save() {}
      splitTextToSize(text: string) {
        return [text];
      }
      text(text: string) {
        pdfTexts.push(text);
      }
    },
  };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfTexts.length = 0;
  });

  it('does not include hidden PDF-only clauses absent from the signing page', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Test Signer',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '3 September 2026',
    });

    const text = pdfTexts.join('\n');
    expect(text).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(text).not.toContain("Reinstatement shall not waive the Service Provider's right");
    expect(text).not.toContain('Either Party may terminate immediately');
    expect(text).not.toContain('appointment shall follow Section 11');
    expect(text).toContain('5.7. Upon receipt of all outstanding payments');
    expect(text).toContain('15.3. Seat and venue: Bengaluru, Karnataka.');
  });
});
