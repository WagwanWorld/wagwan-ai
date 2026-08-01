import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateAgreementPdf } from '../src/lib/utils/agreementPdf';

const { writtenText } = vi.hoisted(() => ({
  writtenText: [] as string[],
}));

vi.mock('jspdf', () => {
  const MockJsPDF = vi.fn(() => ({
    addImage: vi.fn(),
    addPage: vi.fn(),
    line: vi.fn(),
    save: vi.fn(),
    setDrawColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    text: vi.fn((text: string | string[]) => {
      if (Array.isArray(text)) {
        writtenText.push(...text);
      } else {
        writtenText.push(text);
      }
    }),
  }));

  return { default: MockJsPDF };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    writtenText.length = 0;
  });

  it('does not add legal clauses that are not displayed on the signing page', () => {
    generateAgreementPdf({
      signerName: 'Jane Doe',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '1 August 2026',
    });

    const pdfText = writtenText.join('\n');

    expect(pdfText).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(pdfText).toContain(
      '7.3. Upon termination: Fuzone shall cease Platform use and clear outstanding dues. The Service Provider shall provide all raw Client Data within fifteen (15) business days.',
    );
    expect(pdfText).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );

    expect(pdfText).not.toContain('5.7. During the grace period');
    expect(pdfText).not.toContain('Reinstatement shall not waive');
    expect(pdfText).not.toContain('terminate immediately if Platform services are discontinued');
    expect(pdfText).not.toContain('The liability cap is based on actual commissions');
    expect(pdfText).not.toContain('appointment shall follow Section 11');
  });
});
