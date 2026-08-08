import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfMock = vi.hoisted(() => ({
  textCalls: [] as string[],
  save: vi.fn(),
  addImage: vi.fn(),
}));

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    addPage: vi.fn(),
    splitTextToSize: (text: string) => [text],
    text: (text: string | string[]) => {
      pdfMock.textCalls.push(...(Array.isArray(text) ? text : [text]));
    },
    addImage: pdfMock.addImage,
    save: pdfMock.save,
  })),
}));

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfMock.textCalls = [];
    pdfMock.save.mockClear();
    pdfMock.addImage.mockClear();
  });

  it('matches the visible agreement terms without adding hidden PDF-only clauses', async () => {
    const { generateAgreementPdf } = await import('$lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Asha Rao',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '8 August 2026',
    });

    const text = pdfMock.textCalls.join('\n');

    expect(text).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(text).toContain(
      '5.6. Upon receipt of all outstanding payments, access shall be reinstated within two (2) business days.',
    );
    expect(text).toContain(
      '7.3. Upon termination: Fuzone shall cease Platform use and clear outstanding dues. The Service Provider shall provide all raw Client Data within fifteen (15) business days.',
    );
    expect(text).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );

    expect(text).not.toContain('During the grace period, services shall continue uninterrupted.');
    expect(text).not.toContain("Reinstatement shall not waive the Service Provider's right");
    expect(text).not.toContain('Either Party may terminate immediately');
    expect(text).not.toContain('If the Parties cannot agree on an arbitrator');
    expect(text).not.toContain('appointment shall follow Section 11 of the Act');
    expect(pdfMock.save).toHaveBeenCalledWith('Service Agreement Fuzone.pdf');
  });
});
