import { beforeEach, describe, expect, it, vi } from 'vitest';

const { textCalls } = vi.hoisted(() => ({ textCalls: [] as string[] }));

vi.mock('jspdf', () => {
  class MockJsPDF {
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
        textCalls.push(...text);
      } else {
        textCalls.push(text);
      }
    }
  }

  return { default: MockJsPDF };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    textCalls.length = 0;
  });

  it('does not add legal clauses that are absent from the signing page', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Asha',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '26 August 2026',
    });

    const pdfText = textCalls.join('\n');
    expect(pdfText).not.toContain('services shall continue uninterrupted');
    expect(pdfText).not.toContain('interest or penalties from prior non-payment');
    expect(pdfText).not.toContain('fees materially changed mid-term');
    expect(pdfText).not.toContain('appointment shall follow Section 11');
    expect(pdfText).not.toContain('This limitation applies to all claims under this Agreement');
    expect(pdfText).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(pdfText).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );
  });
});
