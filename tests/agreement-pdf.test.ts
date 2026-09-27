import { describe, expect, it, vi } from 'vitest';

const pdfText = vi.hoisted(() => [] as string[]);

vi.mock('jspdf', () => {
  class MockJsPdf {
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
    text(text: string | string[]) {
      if (Array.isArray(text)) {
        pdfText.push(...text);
      } else {
        pdfText.push(text);
      }
    }
  }

  return { default: MockJsPdf };
});

describe('generateAgreementPdf', () => {
  it('does not include PDF-only legal clauses absent from the signed page', async () => {
    pdfText.length = 0;
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Signer',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '2026-09-27',
    });

    const text = pdfText.join('\n');
    expect(text).toContain('5.5. In the event of payment default');
    expect(text).toContain('Failure to pay within this period allows suspension');
    expect(text).toContain('5.6. Upon receipt of all outstanding payments');
    expect(text).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(text).not.toContain("Reinstatement shall not waive the Service Provider's right");
    expect(text).not.toContain('immediate termination if Platform services are discontinued');
    expect(text).not.toContain('The liability cap is based on actual commissions');
    expect(text).not.toContain('The affected Party shall promptly notify the other');
    expect(text).not.toContain('If the Parties cannot agree on an arbitrator');
  });
});
