import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAgreementPdf } from '../src/lib/utils/agreementPdf';

const pdfMock = vi.hoisted(() => ({
  textCalls: [] as string[],
}));

vi.mock('jspdf', () => ({
  default: class MockJsPDF {
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
      pdfMock.textCalls.push(Array.isArray(text) ? text.join('\n') : text);
    }
    addImage() {}
    save() {}
  },
}));

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfMock.textCalls.length = 0;
  });

  it('does not add legal terms that are absent from the accepted web agreement', () => {
    generateAgreementPdf({
      signerName: 'Jane Doe',
      companyName: 'Fuzone Bengaluru Pvt Ltd',
      signatureDataUrl: null,
      date: '30 August 2026',
    });

    const text = pdfMock.textCalls.join('\n');

    expect(text).toContain('Failure to pay within this period allows suspension');
    expect(text).toContain('7.1. This Agreement shall commence on the Effective Date');
    expect(text).toContain('15.2. Seat and venue: Bengaluru, Karnataka.');

    expect(text).not.toContain('During the grace period, services shall continue uninterrupted.');
    expect(text).not.toContain('Reinstatement shall not waive');
    expect(text).not.toContain('terminate immediately if Platform services are discontinued');
    expect(text).not.toContain('appointment shall follow Section 11 of the Act');
  });
});
