import jsPDF from 'jspdf';

const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN_L = 25;
const MARGIN_R = 25;
const MARGIN_T = 30;
const MARGIN_B = 25;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const LINE_H = 5.5;

interface SigningInfo {
  signerName: string;
  companyName: string;
  signatureDataUrl: string | null;
  date: string;
}

export function generateAgreementPdf(info: SigningInfo) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN_T;

  function checkPage(needed: number = LINE_H * 2) {
    if (y + needed > PAGE_H - MARGIN_B) {
      doc.addPage();
      y = MARGIN_T;
      addHeader();
    }
  }

  function addHeader() {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(200, 60, 60);
    doc.text('wagwan', PAGE_W / 2, 15, { align: 'center' });
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN_L, 20, PAGE_W - MARGIN_R, 20);
    doc.setTextColor(0, 0, 0);
  }

  function heading(text: string) {
    checkPage(LINE_H * 3);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(text, MARGIN_L, y);
    y += LINE_H + 1;
  }

  function body(text: string, indent: number = 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent);
    for (const line of lines) {
      checkPage();
      doc.text(line, MARGIN_L + indent, y);
      y += LINE_H;
    }
    y += 1;
  }

  function boldBody(text: string, indent: number = 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent);
    for (const line of lines) {
      checkPage();
      doc.text(line, MARGIN_L + indent, y);
      y += LINE_H;
    }
    doc.setFont('helvetica', 'normal');
    y += 1;
  }

  function numberedItem(num: string, text: string, indent: number = 5) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    checkPage();
    doc.text(num, MARGIN_L + indent - 4, y);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent - 4);
    for (const line of lines) {
      checkPage();
      doc.text(line, MARGIN_L + indent + 4, y);
      y += LINE_H;
    }
    y += 0.5;
  }

  const cn = info.companyName;

  // ── Page 1 ──
  addHeader();
  y = 30;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SERVICE AGREEMENT', PAGE_W / 2, y, { align: 'center' });
  y += 10;

  body(
    'This Service Agreement (hereinafter referred to as the "Agreement") is made and entered into on the date of digital execution below, by and between:',
  );
  y += 2;

  heading('BETWEEN:');
  body(
    `Wagwan World LLP, a company incorporated under the Companies Act, 2013, having its registered office at 672 Ferns Paradise, 4th Street, Doddaanakundi, Bangalore, Karnataka, India, 560037 (hereinafter referred to as the "Service Provider" or "Wagwan", which expression shall, unless repugnant to the context or meaning thereof, be deemed to mean and include its successors and permitted assigns) of the FIRST PART;`,
  );
  y += 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('AND', PAGE_W / 2, y, { align: 'center' });
  y += LINE_H + 2;

  body(
    `${cn}, (hereinafter referred to as the "Client", which expression shall, unless repugnant to the context or meaning thereof, be deemed to mean and include its proprietors, partners, successors, and permitted assigns) of the SECOND PART.`,
  );
  y += 1;
  body(
    `(The Service Provider and the Client shall hereinafter be individually referred to as a "Party" and collectively as "Parties".)`,
  );
  y += 2;

  // Recitals
  heading('RECITALS');
  numberedItem(
    '1.',
    'The Service Provider is engaged in the business of owning, operating, and managing various forms of accommodation and hospitality ventures, including but not limited to hotels, long-stay rental accommodations, paying guest services, and restaurants. In furtherance of its business, the Service Provider has developed and owns a proprietary web-based event and community management software platform (the "Platform").',
  );
  numberedItem(
    '2.',
    `${cn} is engaged in the business of operating a premium nightlife and entertainment venue and wishes to utilize the Service Provider's Platform for its operational needs.`,
  );
  numberedItem(
    '3.',
    `The Service Provider has agreed to grant ${cn} a non-exclusive, non-transferable license to access and use the Platform, and ${cn} has agreed to avail the services in accordance with the terms and conditions set forth in this Agreement.`,
  );
  y += 2;

  boldBody(
    'NOW, THEREFORE, IN CONSIDERATION OF THE MUTUAL COVENANTS AND AGREEMENTS HEREIN CONTAINED, THE PARTIES HERETO AGREE AS FOLLOWS:',
  );
  y += 2;

  // 1. Definitions
  heading('1. DEFINITIONS');
  body(
    '1.1. "Business Day" means any day other than Saturday, Sunday, or a public holiday in Bengaluru, India.',
  );
  body(
    '1.2. "Confidential Information" means any and all information, whether oral, written, or in any other form, disclosed by one Party to the other, including but not limited to customer data, financial information, business strategies, and technical data related to the Platform.',
  );
  body(
    `1.3. "Customer" means any individual who purchases tickets, pays cover charges, or otherwise engages with ${cn}'s services through the Platform.`,
  );
  body(
    '1.4. "Effective Date" means the date of digital execution on which this Agreement becomes effective.',
  );
  body(
    '1.5. "Platform" means the Service Provider\'s proprietary web-based software, including all its modules, features, and functionalities as described in Clause 2.',
  );
  body(
    `1.6. "Service Fees" means the fees payable by ${cn} to the Service Provider as detailed in Clause 5.`,
  );

  // 2. Scope
  heading('2. SCOPE OF SERVICES');
  body(
    `2.1. The Service Provider shall provide ${cn} with access to its Platform, which includes the following features and services:`,
  );
  numberedItem(
    'a)',
    'Guestlisting System: A digital solution for managing guest entries and controlling access to events.',
  );
  numberedItem(
    'b)',
    'Cover Charge System: An integrated payment collection system for processing cover charges from Customers.',
  );
  numberedItem(
    'c)',
    'Ticketing Infrastructure: A comprehensive module for issuing, selling, tracking, and managing event tickets.',
  );
  numberedItem(
    'd)',
    'On Spot Entry: Ticket QR system for seamless entry for increasing efficiency.',
  );
  numberedItem(
    'e)',
    `Community Management Tools: Features designed to build, engage, and maintain digital communities of ${cn}'s patrons.`,
  );
  numberedItem(
    'f)',
    'Admin Dashboard: A centralized administrative panel for managing events, monitoring payments, accessing guest data, and reviewing analytics.',
  );
  numberedItem(
    'g)',
    'Communication Tools: Integrated utilities for sending promotional and informational messages to attendees and community members via WhatsApp and Email.',
  );
  numberedItem(
    'h)',
    'The Service Provider (Wagwan World LLP) shall ensure that the Platform remains operational and accessible at least ninety-seven percent (97%) of the time in any given calendar month, excluding scheduled maintenance and force majeure events.',
  );
  numberedItem(
    'i)',
    `In the event that Platform uptime falls below the guaranteed threshold, ${cn} shall be entitled to service credits or monetary adjustments in accordance with Clause 10.2.`,
  );
  numberedItem(
    'j)',
    'The uptime performance shall be measured monthly, and all claims for service credits must be made in writing.',
  );
  numberedItem(
    'k)',
    `${cn} shall have the right to reconcile and review all transaction data generated through the Platform on a monthly basis. Upon written request, the Service Provider shall provide detailed transaction reports within five (5) business days.`,
  );
  numberedItem(
    'l)',
    `${cn} may verify the accuracy of Platform-reported data against its internal records, and both Parties shall cooperate in good faith to resolve any discrepancies.`,
  );
  numberedItem(
    'm)',
    `${cn}'s review rights under this clause shall be limited to financial and transactional data relevant to its own account.`,
  );

  // 3. Term
  heading('3. TERM OF AGREEMENT');
  body(
    'This Agreement shall remain in full force and effect for a period of three (3) years from the Effective Date, unless terminated earlier. Upon expiry, the Agreement may be renewed by mutual written consent.',
  );

  // 4. Obligations
  heading('4. OBLIGATIONS OF THE CLIENT');
  body(
    `4.1. ${cn} shall be solely responsible for the accuracy, quality, and legality of all content, data, and information related to its events and services.`,
  );
  body(
    `4.2. ${cn} shall be the "seller of record" for all transactions processed through the Platform. The Service Provider acts merely as a technology facilitator.`,
  );
  body(
    `4.3. ${cn} shall ensure timely payment of all fees and charges as stipulated in this Agreement.`,
  );
  body(
    `4.4. ${cn} shall be solely responsible for all customer service, inquiries, disputes, and communications related to its events and offerings.`,
  );

  // 5. Financial
  heading('5. FINANCIAL TERMS AND PAYMENT');
  body(
    `5.1. Product Fee: ${cn} shall pay a yearly minimum fee of INR 10,000 for the continued use of the Platform.`,
  );
  body('5.2. Service Charges:');
  numberedItem(
    '1)',
    'The Service Provider shall levy a 5% service charge on the value of all cover charges processed through the platform per month, offloaded to the consumer.',
  );
  numberedItem(
    '2)',
    'The Service Provider shall levy a service charge of 5% on the value of all ticket payments processed through the platform, offloaded to the consumer.',
  );
  numberedItem(
    '3)',
    'After an initial period of six (6) months, the Parties may review the commission structure. Any revision shall require mutual written agreement. The total commission shall not exceed twenty percent (20%) of the total transaction value.',
  );
  body(
    '5.3. Pass-Through Costs: All service charges, payment gateway fees, and GST shall be offloaded to the Customer at the point of sale.',
  );
  body(
    `5.4. Payouts: All funds collected on behalf of ${cn}, net of fees, shall be remitted within 1 to 5 business days.`,
  );
  body(
    '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
  );
  body(
    '5.6. Upon receipt of all outstanding payments, access shall be reinstated within two (2) business days.',
  );

  // 6. Refunds
  heading('6. REFUNDS, CHARGEBACKS, AND LIABILITY');
  body(
    "6.1. Facilitation of Refunds. The Service Provider shall facilitate refund requests through the Platform's integrated payment system. Such facilitation is a technical and operational function only.",
  );
  body(
    `6.2. Sole Financial Responsibility. ${cn} shall remain solely and exclusively responsible for funding and approving all customer refunds.`,
  );
  body(
    "6.3. Refund Liability for Technical Errors. If a refund arises solely due to a technical error attributable to the Service Provider's Platform, the Service Provider shall bear only the associated refund processing fees, penalty fees, or chargeback fees.",
  );
  body(
    "6.4. The Service Provider's liability is limited to refund fees only and does not extend to the ticket price or transaction amount.",
  );
  body(
    `6.5. Chargebacks. ${cn} shall bear full financial responsibility for chargebacks. If a chargeback arises solely from a verified technical error, Wagwan shall reimburse the corresponding chargeback fees within fifteen (15) business days.`,
  );
  body(
    '6.6. Non-Refundable Fees. All service fees, subscription fees, and platform charges are non-refundable.',
  );
  body(
    '6.7. No Liability for Non-Technical Disputes. The Service Provider shall not be liable for disputes arising from non-technical issues.',
  );
  body(
    '6.8. Cooperation. Both Parties shall cooperate in good faith to investigate and resolve refund or chargeback matters.',
  );

  // 7. Term and Termination
  heading('7. TERM AND TERMINATION');
  body(
    '7.1. This Agreement shall commence on the Effective Date and remain in effect for the period stated in Clause 3, unless terminated earlier.',
  );
  body("7.2. Either Party may terminate with 30 days' prior written notice.");
  body(
    `7.3. Upon termination: ${cn} shall cease Platform use and clear outstanding dues. The Service Provider shall provide all raw Client Data within fifteen (15) business days.`,
  );

  // 8. IP
  heading('8. INTELLECTUAL PROPERTY RIGHTS');
  body(
    '8.1. The Service Provider retains all right, title, and interest in its proprietary Platform, including all underlying software, technology, and intellectual property.',
  );
  body(
    `8.2. ${cn} retains full ownership of its brand identity, logos, trademarks, event content, and all customer data collected through the Platform.`,
  );

  // 9. Data
  heading('9. DATA OWNERSHIP AND COMMON DATA');
  body(
    `9.1. Data Ownership. All data collected exclusively under ${cn}'s brand shall be the sole and exclusive property of ${cn}.`,
  );
  body(
    '9.2. Common Data. Data from users interacting through the Wagwan Ecosystem shall constitute "Common Data" jointly owned by both Parties.',
  );
  body(
    '9.3. Confidentiality. Both Parties agree to maintain confidentiality of all Confidential Information for a period of two (2) years from termination.',
  );
  body(
    '9.4. Data Security. The Service Provider shall implement appropriate technical and organizational security measures.',
  );
  body(
    '9.5. Aggregated Data. The Service Provider may use anonymized and aggregated forms of Client Data for research and product improvement.',
  );
  body(
    '9.6. Onboarding and Support. The Service Provider shall provide onboarding assistance and reasonable technical support.',
  );

  // 10. GST
  heading('10. GST AND INVOICING');
  body(
    `10.1. The Service Provider shall issue a tax invoice on a monthly/yearly basis to ${cn} with applicable GST.`,
  );
  body('10.2. All amounts are exclusive of GST unless expressly stated otherwise.');
  body('10.3. Both Parties shall comply with the Goods and Services Tax Act, 2017.');
  body(`10.4. ${cn} shall be entitled to claim input tax credit on GST paid.`);

  // 11. Indemnification
  heading('11. INDEMNIFICATION');
  body(
    `11.1. ${cn} agrees to indemnify and hold harmless the Service Provider from claims arising out of: breach of this Agreement, negligence in Platform use, Customer claims including refunds or event cancellations, and failure to comply with tax or regulatory obligations.`,
  );
  body(
    "11.2. This indemnity shall not extend to liability arising from the Service Provider's own acts or compliance failures.",
  );

  // 12. Limitation
  heading('12. LIMITATION OF LIABILITY');
  body(
    '12.1. Total aggregate liability shall not exceed the total revenue generated in the preceding three (3) calendar months.',
  );
  body(
    '12.2. The Service Provider shall not be liable for any indirect, consequential, incidental, punitive, or special damages.',
  );
  body(
    `12.3. In the event of gross negligence or fraud, ${cn} shall provide written notice within two (2) months. A one (1) month rectification period shall be granted.`,
  );

  // 13. Force Majeure
  heading('13. FORCE MAJEURE');
  body(
    '13.1. Neither Party shall be liable for any failure or delay due to events beyond reasonable control.',
  );
  body(
    '13.2. If the Force Majeure Event continues for sixty (60) consecutive days, either Party may terminate upon written notice.',
  );

  // 14. Governing Law
  heading('14. GOVERNING LAW AND JURISDICTION');
  body(
    '14.1. This Agreement shall be governed by the laws of India. The courts in Bangalore, Karnataka, India, shall have exclusive jurisdiction.',
  );

  // 15. Dispute Resolution
  heading('15. DISPUTE RESOLUTION');
  body(
    '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
  );
  body(
    '15.2. Seat and venue: Bengaluru, Karnataka. Proceedings in English. Award shall be final and binding.',
  );

  // 16. Miscellaneous
  heading('16. MISCELLANEOUS');
  body(
    '16.1. Entire Agreement: This Agreement constitutes the entire understanding between the Parties.',
  );
  body(
    '16.2. Severability: If any provision is held invalid, the remaining provisions remain in full force.',
  );
  body('16.3. Waiver: No waiver of any term shall be deemed a continuing waiver.');
  body(
    '16.4. Notices: Any notice shall be in writing and sent to the registered office addresses.',
  );

  // ── Signing Block ──
  y += 6;
  checkPage(60);

  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN_L, y, PAGE_W - MARGIN_R, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('IN WITNESS WHEREOF,', PAGE_W / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('the Parties have executed this Agreement as of the Effective Date.', PAGE_W / 2, y, {
    align: 'center',
  });
  y += 12;

  const col1 = MARGIN_L;
  const col2 = PAGE_W / 2 + 5;

  // Left: Wagwan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Wagwan World LLP', col1, y);
  doc.text(`For ${cn}`, col2, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Name:', col1, y);
  doc.text('Name:', col2, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Madhvik Nemani', col1 + 20, y);
  doc.text(info.signerName, col2 + 20, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Title:', col1, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Founder, CEO', col1 + 20, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Date:', col1, y);
  doc.text('Date:', col2, y);
  doc.setTextColor(0, 0, 0);
  doc.text(info.date, col1 + 20, y);
  doc.text(info.date, col2 + 20, y);
  y += 7;

  doc.setTextColor(100, 100, 100);
  doc.text('Signature:', col1, y);
  doc.text('Signature:', col2, y);
  doc.setTextColor(0, 0, 0);
  y += 2;

  // Wagwan signature (text-based)
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(14);
  doc.text('Madhvik Nemani', col1 + 2, y + 8);

  // Client signature (image)
  if (info.signatureDataUrl) {
    try {
      doc.addImage(info.signatureDataUrl, 'PNG', col2 + 2, y, 50, 15);
    } catch {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(14);
      doc.text(info.signerName, col2 + 2, y + 8);
    }
  }

  // Save
  const fileName = `Service Agreement ${cn}.pdf`;
  doc.save(fileName);
}
