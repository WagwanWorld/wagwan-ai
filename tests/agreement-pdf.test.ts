import { beforeEach, describe, expect, it, vi } from 'vitest';

let capturedText: string[] = [];

vi.mock('jspdf', () => {
  return {
    default: class MockJsPdf {
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
        if (Array.isArray(text)) {
          capturedText.push(...text);
        } else {
          capturedText.push(text);
        }
      }
    },
  };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    capturedText = [];
  });

  it('does not include PDF-only legal clauses absent from the signing page', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Test Signer',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '6 August 2026',
    });

    const text = capturedText.join('\n');
    expect(text).toContain('5.6. Upon receipt of all outstanding payments');
    expect(text).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );

    expect(text).not.toContain('5.7. During the grace period');
    expect(text).not.toContain('5.8. Upon receipt of all outstanding payments');
    expect(text).not.toContain('5.9. Reinstatement shall not waive');
    expect(text).not.toContain('Either Party may terminate immediately');
    expect(text).not.toContain('liability cap is based on actual commissions');
    expect(text).not.toContain('affected Party shall promptly notify');
    expect(text).not.toContain('If the Parties cannot agree on an arbitrator');
  });
});
