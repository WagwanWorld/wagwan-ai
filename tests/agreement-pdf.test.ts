import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfState = vi.hoisted(() => ({
  text: [] as string[],
  savedFileName: '',
}));

vi.mock('jspdf', () => {
  class MockJsPDF {
    setFont = vi.fn();
    setFontSize = vi.fn();
    setTextColor = vi.fn();
    setDrawColor = vi.fn();
    line = vi.fn();
    addPage = vi.fn();
    addImage = vi.fn();

    text(value: string | string[]) {
      pdfState.text.push(Array.isArray(value) ? value.join(' ') : value);
    }

    splitTextToSize(value: string) {
      return [value];
    }

    save(fileName: string) {
      pdfState.savedFileName = fileName;
    }
  }

  return { default: MockJsPDF };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfState.text = [];
    pdfState.savedFileName = '';
  });

  it('does not add contract terms hidden from the signing page', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Riya Shah',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '2026-09-01',
    });

    const text = pdfState.text.join('\n');
    expect(text).toContain('5.5. In the event of payment default');
    expect(text).toContain('5.6. Upon receipt of all outstanding payments');
    expect(text).toContain('15.2. Seat and venue: Bengaluru, Karnataka');
    expect(text).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(text).not.toContain('Reinstatement shall not waive');
    expect(text).not.toContain('terminate immediately if Platform services are discontinued');
    expect(text).not.toContain('liability cap is based on actual commissions');
    expect(text).not.toContain('affected Party shall promptly notify');
    expect(text).not.toContain('Section 11 of the Act');
    expect(pdfState.savedFileName).toBe('Service Agreement Fuzone.pdf');
  });
});
