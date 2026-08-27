import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfState = vi.hoisted(() => ({
  text: [] as string[],
  savedFileName: '',
}));

vi.mock('jspdf', () => {
  class MockJsPdf {
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
        pdfState.text.push(...text);
      } else {
        pdfState.text.push(text);
      }
    }
    addImage() {}
    save(fileName: string) {
      pdfState.savedFileName = fileName;
    }
  }

  return { default: MockJsPdf };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfState.text = [];
    pdfState.savedFileName = '';
  });

  it('matches the displayed agreement without PDF-only legal clauses', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Jane Doe',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '27 August 2026',
    });

    const pdfText = pdfState.text.join('\n');
    expect(pdfText).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(pdfText).toContain(
      '7.3. Upon termination: Fuzone shall cease Platform use and clear outstanding dues. The Service Provider shall provide all raw Client Data within fifteen (15) business days.',
    );
    expect(pdfText).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );

    expect(pdfText).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(pdfText).not.toContain('claim interest or penalties from prior non-payment');
    expect(pdfText).not.toContain('terminate immediately if Platform services are discontinued');
    expect(pdfText).not.toContain('appointment shall follow Section 11 of the Act');
    expect(pdfText).not.toContain('actual commissions and subscription revenues');
    expect(pdfState.savedFileName).toBe('Service Agreement Fuzone.pdf');
  });
});
