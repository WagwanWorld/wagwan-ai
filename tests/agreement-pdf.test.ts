import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfInstances: MockJsPDF[] = [];

class MockJsPDF {
  textCalls: string[] = [];

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

  text(text: string) {
    this.textCalls.push(text);
  }
}

vi.mock('jspdf', () => ({
  default: class extends MockJsPDF {
    constructor() {
      super();
      pdfInstances.push(this);
    }
  },
}));

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfInstances.length = 0;
  });

  it('does not add legal clauses that are absent from the visible signing agreement', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Jane Signer',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '25 August 2026',
    });

    const pdfText = pdfInstances.flatMap((instance) => instance.textCalls).join('\n');

    expect(pdfText).toContain('5.5. In the event of payment default');
    expect(pdfText).toContain(
      '5.6. Upon receipt of all outstanding payments, access shall be reinstated',
    );
    expect(pdfText).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(pdfText).not.toContain('Reinstatement shall not waive');
    expect(pdfText).not.toContain('Platform services are discontinued or fees materially changed');
    expect(pdfText).not.toContain('The liability cap is based on actual commissions');
    expect(pdfText).not.toContain('This limitation applies to all claims');
    expect(pdfText).not.toContain('The affected Party shall promptly notify');
    expect(pdfText).not.toContain('appointment shall follow Section 11');
  });
});
