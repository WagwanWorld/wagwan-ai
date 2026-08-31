import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfText = vi.hoisted(() => [] as string[]);

vi.mock('jspdf', () => {
  class MockJsPdf {
    addPage = vi.fn();
    setFont = vi.fn();
    setFontSize = vi.fn();
    setTextColor = vi.fn();
    setDrawColor = vi.fn();
    line = vi.fn();
    addImage = vi.fn();
    save = vi.fn();
    splitTextToSize = vi.fn((text: string) => [text]);
    text = vi.fn((text: string | string[]) => {
      if (Array.isArray(text)) {
        pdfText.push(...text);
      } else {
        pdfText.push(text);
      }
    });
  }

  return { default: MockJsPdf };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfText.length = 0;
  });

  it('does not add hidden PDF-only legal clauses after signing', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Jane Founder',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '31 August 2026',
    });

    const text = pdfText.join('\n');

    expect(text).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(text).toContain(
      '5.6. Upon receipt of all outstanding payments, access shall be reinstated within two (2) business days.',
    );
    expect(text).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(text).not.toContain('interest or penalties from prior non-payment');
    expect(text).not.toContain('fees materially changed mid-term');
    expect(text).not.toContain('Each Party shall remain individually responsible');
    expect(text).not.toContain('actual commissions and subscription revenues');
    expect(text).not.toContain('appointment shall follow Section 11');
  });
});
