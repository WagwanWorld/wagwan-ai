import { beforeEach, describe, expect, it, vi } from 'vitest';

const textCalls: string[] = [];

class MockJsPDF {
  setFont = vi.fn();
  setFontSize = vi.fn();
  setTextColor = vi.fn();
  setDrawColor = vi.fn();
  line = vi.fn();
  addPage = vi.fn();
  addImage = vi.fn();
  save = vi.fn();

  text(value: string | string[]) {
    if (Array.isArray(value)) {
      textCalls.push(...value);
    } else {
      textCalls.push(value);
    }
  }

  splitTextToSize(value: string) {
    return [value];
  }
}

vi.mock('jspdf', () => ({ default: MockJsPDF }));

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    textCalls.length = 0;
  });

  it('does not emit PDF-only agreement terms absent from the signed page', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Client Signer',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '2026-09-29',
    });

    const pdfText = textCalls.join('\n');
    expect(pdfText).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(pdfText).not.toContain('Reinstatement shall not waive');
    expect(pdfText).not.toContain('fees materially changed mid-term');
    expect(pdfText).not.toContain('liability cap is based on actual commissions');
    expect(pdfText).not.toContain('This limitation applies to all claims');
    expect(pdfText).not.toContain('affected Party shall promptly notify');
    expect(pdfText).not.toContain('appointment shall follow Section 11');
    expect(pdfText).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
  });
});
