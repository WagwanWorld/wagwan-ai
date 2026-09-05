import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfState = vi.hoisted(() => ({
  text: [] as string[],
  savedAs: [] as string[],
}));

vi.mock('jspdf', () => {
  class MockJsPDF {
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
      pdfState.text.push(Array.isArray(text) ? text.join(' ') : text);
    }
    save(fileName: string) {
      pdfState.savedAs.push(fileName);
    }
  }

  return { default: MockJsPDF };
});

import { generateAgreementPdf } from '../src/lib/utils/agreementPdf';

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfState.text.length = 0;
    pdfState.savedAs.length = 0;
  });

  it('does not add material terms that are absent from the visible signed agreement', () => {
    generateAgreementPdf({
      signerName: 'Asha Rao',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '5 September 2026',
    });

    const text = pdfState.text.join('\n');
    expect(text).toContain('5.5. In the event of payment default');
    expect(text).toContain('5.6. Upon receipt of all outstanding payments');
    expect(text).toContain('15.2. Seat and venue: Bengaluru');
    expect(text).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(text).not.toContain('Reinstatement shall not waive');
    expect(text).not.toContain('Either Party may terminate immediately');
    expect(text).not.toContain('This limitation applies to all claims');
    expect(text).not.toContain('If the Parties cannot agree on an arbitrator');
    expect(pdfState.savedAs).toEqual(['Service Agreement Fuzone.pdf']);
  });
});
