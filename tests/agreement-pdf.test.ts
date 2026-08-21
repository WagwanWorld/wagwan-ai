import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfState = vi.hoisted(() => ({
  text: [] as string[],
  savedAs: '',
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
    text(text: string, _x: number, _y: number) {
      pdfState.text.push(text);
    }
    addImage() {}
    save(filename: string) {
      pdfState.savedAs = filename;
    }
  }

  return { default: MockJsPdf };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfState.text = [];
    pdfState.savedAs = '';
  });

  it('does not emit legal clauses that are absent from the visible agreement', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Asha',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '21 August 2026',
    });

    const pdfText = pdfState.text.join('\n');

    expect(pdfText).toContain('5.6. Upon receipt of all outstanding payments');
    expect(pdfText).toContain('15.2. Seat and venue: Bengaluru, Karnataka.');
    expect(pdfText).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(pdfText).not.toContain('Reinstatement shall not waive');
    expect(pdfText).not.toContain('Either Party may terminate immediately');
    expect(pdfText).not.toContain('appointment shall follow Section 11');
    expect(pdfText).not.toContain('penalty fees');
    expect(pdfState.savedAs).toBe('Service Agreement Fuzone.pdf');
  });
});
