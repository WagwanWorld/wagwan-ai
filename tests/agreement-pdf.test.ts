import { describe, expect, it, vi, beforeEach } from 'vitest';

const { pdfInstances } = vi.hoisted(() => ({
  pdfInstances: [] as Array<{ texts: string[]; savedAs: string | null }>,
}));

vi.mock('jspdf', () => {
  class FakeJsPDF {
    texts: string[] = [];
    savedAs: string | null = null;

    constructor() {
      pdfInstances.push(this);
    }

    addPage() {}
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    line() {}
    addImage() {}

    splitTextToSize(text: string) {
      return [text];
    }

    text(text: string | string[]) {
      if (Array.isArray(text)) {
        this.texts.push(...text);
      } else {
        this.texts.push(text);
      }
    }

    save(fileName: string) {
      this.savedAs = fileName;
    }
  }

  return { default: FakeJsPDF };
});

import { generateAgreementPdf } from '../src/lib/utils/agreementPdf';

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfInstances.length = 0;
  });

  it('does not add legal terms that are absent from the signing page', () => {
    generateAgreementPdf({
      signerName: 'Asha Rao',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '2 September 2026',
    });

    const text = pdfInstances[0].texts.join('\n');
    expect(text).toContain('Failure to pay within this period allows suspension');
    expect(text).toContain('access shall be reinstated within two (2) business days');
    expect(text).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(text).not.toContain('interest or penalties from prior non-payment');
    expect(text).not.toContain('fees materially changed mid-term');
    expect(text).not.toContain('appointment shall follow Section 11');
    expect(text).not.toContain('affected Party shall promptly notify');
  });
});
