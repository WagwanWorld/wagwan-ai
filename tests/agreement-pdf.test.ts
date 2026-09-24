import { describe, expect, it, vi } from 'vitest';

const pdfDocs = vi.hoisted(() => [] as Array<{ texts: string[]; save: ReturnType<typeof vi.fn> }>);

vi.mock('jspdf', () => ({
  default: class MockJsPdf {
    texts: string[] = [];
    save = vi.fn();

    constructor() {
      pdfDocs.push(this);
    }

    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    line() {}
    addPage() {}
    addImage() {}
    splitTextToSize(text: string) {
      return [text];
    }
    text(text: string) {
      this.texts.push(text);
    }
  },
}));

import { generateAgreementPdf } from '../src/lib/utils/agreementPdf';

describe('generateAgreementPdf', () => {
  it('does not add legal clauses that are absent from the signed agreement page', () => {
    generateAgreementPdf({
      signerName: 'Asha Rao',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '24 September 2026',
    });

    const text = pdfDocs.at(-1)?.texts.join('\n') ?? '';

    expect(text).not.toContain('During the grace period, services shall continue uninterrupted.');
    expect(text).not.toContain('Reinstatement shall not waive');
    expect(text).not.toContain('Platform services are discontinued or fees materially changed');
    expect(text).not.toContain('The liability cap is based on actual commissions');
    expect(text).not.toContain('appointment shall follow Section 11');
    expect(text).toContain('Upon receipt of all outstanding payments, access shall be reinstated');
  });
});
