import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfCapture = vi.hoisted(() => ({
  text: [] as string[],
  savedFileName: '',
}));

vi.mock('jspdf', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      addImage: vi.fn(),
      addPage: vi.fn(),
      line: vi.fn(),
      save: vi.fn((fileName: string) => {
        pdfCapture.savedFileName = fileName;
      }),
      setDrawColor: vi.fn(),
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      splitTextToSize: vi.fn((text: string) => [text]),
      text: vi.fn((value: string | string[]) => {
        if (Array.isArray(value)) {
          pdfCapture.text.push(...value);
        } else {
          pdfCapture.text.push(value);
        }
      }),
    })),
  };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfCapture.text = [];
    pdfCapture.savedFileName = '';
  });

  it('does not include PDF-only clauses absent from the signed agreement page', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Asha Rao',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '4 August 2026',
    });

    const output = pdfCapture.text.join('\n');
    expect(output).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(output).toContain(
      '7.3. Upon termination: Fuzone shall cease Platform use and clear outstanding dues. The Service Provider shall provide all raw Client Data within fifteen (15) business days.',
    );
    expect(output).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );
    expect(output).not.toContain('5.7. During the grace period');
    expect(output).not.toContain("Reinstatement shall not waive the Service Provider's right");
    expect(output).not.toContain('Either Party may terminate immediately');
    expect(output).not.toContain('appointment shall follow Section 11');
    expect(pdfCapture.savedFileName).toBe('Service Agreement Fuzone.pdf');
  });
});
