import { describe, expect, it, vi } from 'vitest';
import { generateAgreementPdf } from '../src/lib/utils/agreementPdf';

const { textCalls } = vi.hoisted(() => ({
  textCalls: [] as string[],
}));

vi.mock('jspdf', () => {
  class MockJsPDF {
    addPage() {}
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    line() {}
    splitTextToSize(text: string) {
      return [text];
    }
    text(text: string | string[]) {
      if (Array.isArray(text)) {
        textCalls.push(...text);
      } else {
        textCalls.push(text);
      }
    }
    addImage() {}
    save() {}
  }

  return { default: MockJsPDF };
});

describe('generateAgreementPdf', () => {
  it('does not include legal clauses absent from the displayed agreement', () => {
    textCalls.length = 0;

    generateAgreementPdf({
      signerName: 'Priya Rao',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '26 September 2026',
    });

    const pdfText = textCalls.join('\n');
    expect(pdfText).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(pdfText).not.toContain('interest or penalties from prior non-payment');
    expect(pdfText).not.toContain('fees materially changed mid-term');
    expect(pdfText).not.toContain('liability cap is based on actual commissions');
    expect(pdfText).not.toContain('This limitation applies to all claims');
    expect(pdfText).not.toContain('The affected Party shall promptly notify');
    expect(pdfText).not.toContain('appointment shall follow Section 11');

    expect(pdfText).toContain(
      'Failure to pay within this period allows suspension of Platform access.',
    );
    expect(pdfText).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );
  });
});
