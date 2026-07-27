import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfText = vi.hoisted(() => [] as string[]);

vi.mock('jspdf', () => {
  class MockJsPDF {
    addImage() {}
    addPage() {}
    line() {}
    save() {}
    setDrawColor() {}
    setFont() {}
    setFontSize() {}
    setTextColor() {}

    splitTextToSize(text: string) {
      return [text];
    }

    text(text: string | string[]) {
      if (Array.isArray(text)) {
        pdfText.push(...text);
      } else {
        pdfText.push(text);
      }
    }
  }

  return { default: MockJsPDF };
});

import { generateAgreementPdf } from '../src/lib/utils/agreementPdf';

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfText.length = 0;
  });

  it('does not add undisplayed legal clauses to the signed agreement PDF', () => {
    generateAgreementPdf({
      signerName: 'Jane Signer',
      companyName: 'Acme Venue',
      signatureDataUrl: null,
      date: '27 July 2026',
    });

    const text = pdfText.join('\n');

    expect(text).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(text).toContain(
      '5.6. Upon receipt of all outstanding payments, access shall be reinstated within two (2) business days.',
    );
    expect(text).toContain(
      '7.3. Upon termination: Acme Venue shall cease Platform use and clear outstanding dues. The Service Provider shall provide all raw Client Data within fifteen (15) business days.',
    );
    expect(text).toContain(
      '12.3. In the event of gross negligence or fraud, Acme Venue shall provide written notice within two (2) months. A one (1) month rectification period shall be granted.',
    );

    expect(text).not.toContain('During the grace period, services shall continue uninterrupted.');
    expect(text).not.toContain('interest or penalties from prior non-payment');
    expect(text).not.toContain('Either Party may terminate immediately');
    expect(text).not.toContain('The liability cap is based on actual commissions');
    expect(text).not.toContain('If the Parties cannot agree on an arbitrator');
  });
});
