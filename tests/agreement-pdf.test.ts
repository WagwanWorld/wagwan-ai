import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAgreementPdf } from '../src/lib/utils/agreementPdf';

const pdf = vi.hoisted(() => ({
  lines: [] as string[],
  saves: [] as string[],
}));

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    addPage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    text: vi.fn((text: string) => {
      pdf.lines.push(text);
    }),
    addImage: vi.fn(),
    save: vi.fn((fileName: string) => {
      pdf.saves.push(fileName);
    }),
  })),
}));

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdf.lines = [];
    pdf.saves = [];
  });

  it('does not add material clauses absent from the visible agreement', () => {
    generateAgreementPdf({
      signerName: 'Riya',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '10 September 2026',
    });

    const text = pdf.lines.join('\n');

    expect(text).toContain('Failure to pay within this period allows suspension');
    expect(text).toContain('remain in effect for 12 months.');
    expect(text).toContain('mutually appointed within fifteen (15) days');
    expect(text).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(text).not.toContain('interest or penalties from prior non-payment');
    expect(text).not.toContain('Platform services are discontinued or fees materially changed');
    expect(text).not.toContain('Each Party shall remain individually responsible');
    expect(text).not.toContain('appointment shall follow Section 11');
    expect(text).not.toContain('affected Party shall promptly notify');
    expect(pdf.saves).toEqual(['Service Agreement Fuzone.pdf']);
  });
});
