import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfMock = vi.hoisted(() => ({ textCalls: [] as string[] }));

vi.mock('jspdf', () => {
  return {
    default: class MockJsPDF {
      setFont() {}
      setFontSize() {}
      setTextColor() {}
      setDrawColor() {}
      line() {}
      addPage() {}
      addImage() {}
      save() {}
      splitTextToSize(text: string) {
        return [text];
      }
      text(text: string | string[]) {
        const values = Array.isArray(text) ? text : [text];
        pdfMock.textCalls.push(...values);
      }
    },
  };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfMock.textCalls.length = 0;
  });

  it('does not add legal terms that are absent from the visible agreement', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Jane Doe',
      companyName: 'Acme',
      signatureDataUrl: null,
      date: '2026-09-30',
    });

    const text = pdfMock.textCalls.join('\n');
    expect(text).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(text).not.toContain('Reinstatement shall not waive');
    expect(text).not.toContain('terminate immediately if Platform services are discontinued');
    expect(text).not.toContain('appointment shall follow Section 11');
    expect(text).toContain('5.6. Upon receipt of all outstanding payments');
    expect(text).toContain('15.2. Seat and venue: Bengaluru');
  });
});
