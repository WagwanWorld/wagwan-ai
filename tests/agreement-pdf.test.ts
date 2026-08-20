import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfTexts: string[] = [];

class MockJsPDF {
  setFont() {}
  setFontSize() {}
  setTextColor() {}
  setDrawColor() {}
  line() {}
  addPage() {}
  splitTextToSize(text: string) {
    return [text];
  }
  text(text: string | string[]) {
    if (Array.isArray(text)) {
      pdfTexts.push(...text);
    } else {
      pdfTexts.push(text);
    }
  }
  addImage() {}
  save() {}
}

vi.mock('jspdf', () => ({ default: MockJsPDF }));

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfTexts.length = 0;
  });

  it('does not add PDF-only clauses absent from the signed agreement page', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Test Signer',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '20 August 2026',
    });

    const text = pdfTexts.join('\n');

    expect(text).toContain(
      '5.5. In the event of payment default by Fuzone, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(text).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );

    expect(text).not.toContain('During the grace period, services shall continue uninterrupted.');
    expect(text).not.toContain('Reinstatement shall not waive');
    expect(text).not.toContain('terminate immediately if Platform services are discontinued');
    expect(text).not.toContain('appointment shall follow Section 11');
  });
});
