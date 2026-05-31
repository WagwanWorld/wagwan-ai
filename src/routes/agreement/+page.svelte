<script lang="ts">
  import { enhance } from '$app/forms';
  import SignaturePad from '$lib/components/SignaturePad.svelte';

  let { form } = $props();

  let name = $state(form?.name ?? '');
  let company = $state(form?.company ?? '');
  let signatureData = $state<string | null>(null);
  let signaturePad: SignaturePad;
  let submitting = $state(false);
  let agreed = $state(false);

  /** Display name for the client throughout the contract */
  let clientName = $derived(company.trim() || 'the Client');

  function handleSignatureChange(dataUrl: string | null) {
    signatureData = dataUrl;
  }

  function clearSignature() {
    signaturePad.clear();
    signatureData = null;
  }

  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
</script>

<svelte:head>
  <title>Service Agreement - Wagwan World LLP</title>
  <meta
    name="description"
    content="Digital Service Agreement between Wagwan World LLP and Client"
  />
  <meta name="robots" content="noindex, nofollow" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="agreement-page">
  <!-- Header -->
  <header class="agreement-header">
    <div class="header-inner">
      <div class="logo">wagwan</div>
      <span class="header-tag">Service Agreement</span>
    </div>
  </header>

  {#if form?.success}
    <!-- Success State -->
    <main class="success-container">
      <div class="success-card">
        <div class="success-icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4ade80"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h1>Agreement Signed Successfully</h1>
        <p>
          Thank you, <strong>{form.name}</strong>. Your signed agreement has been recorded and a
          copy will be sent to you shortly.
        </p>
        <div class="success-details">
          <div class="detail-row">
            <span class="detail-label">Signed by</span>
            <span class="detail-value">{form.name}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Company</span>
            <span class="detail-value">{form.company}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date</span>
            <span class="detail-value">{today}</span>
          </div>
        </div>
      </div>
    </main>
  {:else}
    <!-- Sticky Form Bar -->
    <div class="form-sidebar">
      <div class="form-card">
        <h3>Sign this Agreement</h3>
        <p class="form-desc">
          Fill in your details and sign below. Your company name will appear throughout the
          contract.
        </p>

        {#if form?.error}
          <div class="error-banner">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line
                x1="9"
                y1="9"
                x2="15"
                y2="15"
              />
            </svg>
            {form.error}
          </div>
        {/if}

        <form
          method="POST"
          use:enhance={() => {
            submitting = true;
            return async ({ update }) => {
              submitting = false;
              await update();
            };
          }}
        >
          <div class="form-field">
            <label for="name">Your Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              bind:value={name}
              placeholder="e.g. John Doe"
              required
            />
          </div>

          <div class="form-field">
            <label for="company">Company Name</label>
            <input
              id="company"
              name="company"
              type="text"
              bind:value={company}
              placeholder="e.g. Fuzone Bengaluru Pvt Ltd"
              required
            />
            {#if company.trim()}
              <span class="field-hint"
                >This name will replace "the Client" throughout the agreement.</span
              >
            {/if}
          </div>

          <div class="form-field">
            <label>Digital Signature</label>
            <SignaturePad bind:this={signaturePad} onSignatureChange={handleSignatureChange} />
            <div class="signature-actions">
              <button type="button" class="btn-clear" onclick={clearSignature}>Clear</button>
            </div>
            <input type="hidden" name="signature" value={signatureData ?? ''} />
          </div>

          <label class="checkbox-label">
            <input type="checkbox" bind:checked={agreed} required />
            <span>I have read and agree to the terms of this Service Agreement.</span>
          </label>

          <button
            type="submit"
            class="btn-submit"
            disabled={submitting || !name || !company || !signatureData || !agreed}
          >
            {#if submitting}
              <span class="spinner"></span>
              Signing...
            {:else}
              Sign Agreement
            {/if}
          </button>
        </form>
      </div>
    </div>

    <!-- Agreement Content -->
    <main class="agreement-container">
      <div class="agreement-document">
        <!-- Title -->
        <div class="doc-title-section">
          <h1 class="doc-title">SERVICE AGREEMENT</h1>
          <p class="doc-subtitle">
            This Service Agreement (hereinafter referred to as the "Agreement") is made and entered
            into on the date of digital execution below, by and between:
          </p>
        </div>

        <!-- Parties -->
        <section class="doc-section">
          <h2>BETWEEN:</h2>
          <p>
            <strong>Wagwan World LLP</strong>, a company incorporated under the Companies Act, 2013,
            having its registered office at 672 Ferns Paradise, 4th Street, Doddaanakundi,
            Bangalore, Karnataka, India, 560037 (hereinafter referred to as the "<strong
              >Service Provider</strong
            >" or "<strong>Wagwan</strong>", which expression shall, unless repugnant to the context
            or meaning thereof, be deemed to mean and include its successors and permitted assigns)
            of the
            <strong>FIRST PART</strong>;
          </p>
          <p class="and-divider">AND</p>
          <p>
            <strong class="client-highlight">{clientName}</strong>, (hereinafter referred to as the
            "<strong>Client</strong>", which expression shall, unless repugnant to the context or
            meaning thereof, be deemed to mean and include its proprietors, partners, successors,
            and permitted assigns) of the <strong>SECOND PART</strong>.
          </p>
          <p class="party-note">
            (The Service Provider and the Client shall hereinafter be individually referred to as a
            "Party" and collectively as "Parties".)
          </p>
        </section>

        <!-- Recitals -->
        <section class="doc-section">
          <h2>RECITALS</h2>
          <ol class="recitals-list">
            <li>
              The Service Provider is engaged in the business of owning, operating, and managing
              various forms of accommodation and hospitality ventures, including but not limited to
              hotels, long-stay rental accommodations, paying guest services, and restaurants. In
              furtherance of its business, the Service Provider has developed and owns a proprietary
              web-based event and community management software platform (the "Platform").
            </li>
            <li>
              <strong class="client-highlight">{clientName}</strong> is engaged in the business of operating
              a premium nightlife and entertainment venue and wishes to utilize the Service Provider's
              Platform for its operational needs.
            </li>
            <li>
              The Service Provider has agreed to grant <strong class="client-highlight"
                >{clientName}</strong
              >
              a non-exclusive, non-transferable license to access and use the Platform, and
              <strong class="client-highlight">{clientName}</strong> has agreed to avail the services
              in accordance with the terms and conditions set forth in this Agreement.
            </li>
          </ol>
        </section>

        <p class="consideration-clause">
          <strong
            >NOW, THEREFORE, IN CONSIDERATION OF THE MUTUAL COVENANTS AND AGREEMENTS HEREIN
            CONTAINED, THE PARTIES HERETO AGREE AS FOLLOWS:</strong
          >
        </p>

        <!-- Clause 1: Definitions -->
        <section class="doc-section">
          <h2>1. DEFINITIONS</h2>
          <dl class="definitions-list">
            <div class="def-item">
              <dt>1.1. "Business Day"</dt>
              <dd>
                means any day other than Saturday, Sunday, or a public holiday in Bengaluru, India.
              </dd>
            </div>
            <div class="def-item">
              <dt>1.2. "Confidential Information"</dt>
              <dd>
                means any and all information, whether oral, written, or in any other form,
                disclosed by one Party to the other, including but not limited to customer data,
                financial information, business strategies, and technical data related to the
                Platform.
              </dd>
            </div>
            <div class="def-item">
              <dt>1.3. "Customer"</dt>
              <dd>
                means any individual who purchases tickets, pays cover charges, or otherwise engages
                with <strong class="client-highlight">{clientName}</strong>'s services through the
                Platform.
              </dd>
            </div>
            <div class="def-item">
              <dt>1.4. "Effective Date"</dt>
              <dd>
                means the date of digital execution on which this Agreement becomes effective.
              </dd>
            </div>
            <div class="def-item">
              <dt>1.5. "Platform"</dt>
              <dd>
                means the Service Provider's proprietary web-based software, including all its
                modules, features, and functionalities as described in Clause 2.
              </dd>
            </div>
            <div class="def-item">
              <dt>1.6. "Service Fees"</dt>
              <dd>
                means the fees payable by <strong class="client-highlight">{clientName}</strong> to the
                Service Provider as detailed in Clause 4.
              </dd>
            </div>
          </dl>
        </section>

        <!-- Clause 2: Scope of Services -->
        <section class="doc-section">
          <h2>2. SCOPE OF SERVICES</h2>
          <p>
            2.1. The Service Provider shall provide <strong class="client-highlight"
              >{clientName}</strong
            > with access to its Platform, which includes the following features and services:
          </p>
          <ol class="clause-list" type="a">
            <li>
              <strong>Guestlisting System:</strong> A digital solution for managing guest entries and
              controlling access to events.
            </li>
            <li>
              <strong>Cover Charge System:</strong> An integrated payment collection system for processing
              cover charges from Customers.
            </li>
            <li>
              <strong>Ticketing Infrastructure:</strong> A comprehensive module for issuing, selling,
              tracking, and managing event tickets.
            </li>
            <li>
              <strong>On Spot Entry:</strong> Ticket QR system for seamless entry for increasing efficiency.
            </li>
            <li>
              <strong>Community Management Tools:</strong> Features designed to build, engage, and
              maintain digital communities of
              <strong class="client-highlight">{clientName}</strong>'s patrons.
            </li>
            <li>
              <strong>Admin Dashboard:</strong> A centralized administrative panel for managing events,
              monitoring payments, accessing guest data, and reviewing analytics.
            </li>
            <li>
              <strong>Communication Tools:</strong> Integrated utilities for sending promotional and informational
              messages to attendees and community members via WhatsApp and Email.
            </li>
            <li>
              The Service Provider (Wagwan World LLP) shall ensure that the Platform remains
              operational and accessible at least <strong>ninety-seven percent (97%)</strong> of the time
              in any given calendar month, excluding scheduled maintenance and force majeure events.
            </li>
            <li>
              In the event that Platform uptime falls below the guaranteed threshold for reasons
              attributable to the Service Provider, <strong class="client-highlight"
                >{clientName}</strong
              >
              shall be entitled to <strong>service credits or monetary adjustments</strong> in accordance
              with Clause 10.2.
            </li>
            <li>
              The uptime performance shall be measured monthly, and all claims for service credits
              must be made in writing within the time period and procedure specified under Clause
              10.2.
            </li>
            <li>
              <strong class="client-highlight">{clientName}</strong> shall have the right to
              <strong>reconcile and review all transaction data</strong>
              generated through the Platform on a monthly basis. Upon written request, the Service
              Provider shall provide detailed transaction reports within
              <strong>five (5) business days</strong>.
            </li>
            <li>
              <strong class="client-highlight">{clientName}</strong> may verify the accuracy of Platform-reported
              data against its internal records, and both Parties shall cooperate in good faith to resolve
              any discrepancies.
            </li>
            <li>
              <strong class="client-highlight">{clientName}</strong>'s review rights under this
              clause shall be limited to <strong>financial and transactional data</strong> relevant to
              its own account.
            </li>
          </ol>
        </section>

        <!-- Term of Agreement -->
        <section class="doc-section">
          <h2>3. TERM OF AGREEMENT</h2>
          <p>
            a) This Agreement shall remain in full force and effect for a period of <strong
              >three (3) years</strong
            >
            from the Effective Date, unless terminated earlier in accordance with the terms herein.
            Upon expiry of the initial term, the Agreement may be renewed or extended by
            <strong>mutual written consent</strong> of both Parties.
          </p>
        </section>

        <!-- Obligations -->
        <section class="doc-section">
          <h2>4. OBLIGATIONS OF THE CLIENT</h2>
          <p>
            4.1. <strong class="client-highlight">{clientName}</strong> shall be solely responsible for
            the accuracy, quality, and legality of all content, data, and information related to its events
            and services.
          </p>
          <p>
            4.2. <strong class="client-highlight">{clientName}</strong> shall be the "seller of record"
            for all transactions processed through the Platform. The Service Provider acts merely as a
            technology facilitator.
          </p>
          <p>
            4.3. <strong class="client-highlight">{clientName}</strong> shall ensure timely payment of
            all fees and charges as stipulated in this Agreement.
          </p>
          <p>
            4.4. <strong class="client-highlight">{clientName}</strong> shall be solely responsible for
            all customer service, inquiries, disputes, and communications related to its events and offerings.
          </p>
        </section>

        <!-- Financial Terms -->
        <section class="doc-section">
          <h2>5. FINANCIAL TERMS AND PAYMENT</h2>
          <p>
            5.1. <strong>Product Fee:</strong>
            <strong class="client-highlight">{clientName}</strong>
            shall pay a yearly minimum fee of <strong>INR 10,000</strong> for the continued use of the
            Platform.
          </p>
          <p>5.2. <strong>Service Charges:</strong></p>
          <ol class="clause-list">
            <li>
              The Service Provider shall levy a <strong>5% service charge</strong> on the value of all
              cover charges processed through the platform per month, offloaded to the consumer.
            </li>
            <li>
              The Service Provider shall levy a service charge of <strong>5%</strong> on the value of
              all ticket payments processed through the platform, offloaded to the consumer.
            </li>
            <li>
              After an initial period of six (6) months from the Effective Date, the Parties may
              review the commission structure. Any revision shall be effected only through <strong
                >mutual written agreement</strong
              >.
              <ol class="clause-sublist" type="a">
                <li>
                  The total commission chargeable shall <strong
                    >in no event exceed twenty percent (20%)</strong
                  > of the total transaction value.
                </li>
                <li>
                  Until such mutual written amendment is executed, the existing commission structure
                  shall remain in full force and effect.
                </li>
              </ol>
            </li>
          </ol>
          <p>
            5.3. <strong>Pass-Through Costs:</strong> All service charges, applicable payment gateway
            fees, and GST shall be offloaded to the Customer at the point of sale.
          </p>
          <p>
            5.4. <strong>Payouts:</strong> All funds collected on behalf of
            <strong class="client-highlight">{clientName}</strong>, net of fees, shall be remitted
            within <strong>1 to 5 business days</strong>.
          </p>
          <p>
            5.5. In the event of any delay or default in payment by <strong class="client-highlight"
              >{clientName}</strong
            >, the Service Provider shall provide a written notice granting a
            <strong>seven (7) day grace period</strong>.
          </p>
          <p>
            5.6. If <strong class="client-highlight">{clientName}</strong> fails to make payment
            within the grace period, the Service Provider shall have the right to
            <strong>suspend access</strong> to the Platform.
          </p>
          <p>5.7. During the grace period, services shall continue uninterrupted.</p>
          <p>
            5.8. Upon receipt of all outstanding payments, the Service Provider shall <strong
              >promptly reinstate</strong
            >
            access within <strong>two (2) business days</strong>.
          </p>
          <p>
            5.9. Reinstatement shall not waive the Service Provider's right to claim interest or
            penalties from prior non-payment.
          </p>
        </section>

        <!-- Refunds -->
        <section class="doc-section">
          <h2>6. REFUNDS, CHARGEBACKS, AND LIABILITY</h2>
          <p>
            6.1. <strong>Facilitation of Refunds.</strong> The Service Provider shall facilitate
            refund requests through the Platform's integrated payment system. Such facilitation is a
            <strong>technical and operational function only</strong>.
          </p>
          <p>
            6.2. <strong>Sole Financial Responsibility.</strong>
            <strong class="client-highlight">{clientName}</strong>
            shall remain <strong>solely and exclusively responsible</strong> for funding and approving
            all customer refunds.
          </p>
          <p>
            6.3. <strong>Refund Liability for Technical Errors.</strong> If a refund arises solely
            due to a technical error attributable to the Service Provider's Platform, the Service
            Provider shall bear only the associated
            <strong>refund processing fees, penalty fees, or chargeback fees</strong>.
          </p>
          <p>
            6.4. The Service Provider's liability is limited to <strong>refund fees only</strong> and
            does not extend to the ticket price or transaction amount.
          </p>
          <p>
            6.5. <strong>Chargebacks.</strong>
            <strong class="client-highlight">{clientName}</strong>
            shall bear full financial responsibility for chargebacks. If a chargeback arises solely
            from a verified technical error, Wagwan shall reimburse the corresponding chargeback
            fees within <strong>fifteen (15) business days</strong>.
          </p>
          <p>
            6.6. <strong>Non-Refundable Fees.</strong> All service fees, subscription fees, and
            platform charges are <strong>non-refundable</strong>.
          </p>
          <p>
            6.7. <strong>No Liability for Non-Technical Disputes.</strong> The Service Provider shall
            not be liable for disputes arising from non-technical issues.
          </p>
          <p>
            6.8. <strong>Cooperation.</strong> Both Parties shall cooperate in good faith to investigate
            and resolve refund or chargeback matters.
          </p>
        </section>

        <!-- Term and Termination -->
        <section class="doc-section">
          <h2>7. TERM AND TERMINATION</h2>
          <p>
            7.1. <strong>Term:</strong> This Agreement shall commence on the Effective Date and
            remain in effect for <strong>12 months</strong>, unless terminated earlier.
          </p>
          <p>
            7.2. <strong>Termination for Convenience:</strong> Either Party may terminate with
            <strong>30 days' prior written notice</strong>.
          </p>
          <p>7.3. <strong>Obligations upon Termination:</strong></p>
          <ol class="clause-list" type="a">
            <li>
              <strong class="client-highlight">{clientName}</strong> shall immediately cease all use of
              the Platform and clear all outstanding dues.
            </li>
            <li>
              The Service Provider shall, within <strong>fifteen (15) business days</strong>,
              provide <strong class="client-highlight">{clientName}</strong> with all
              <strong>raw Client Data</strong>.
            </li>
            <li>
              Either Party may terminate immediately if Platform services are discontinued or fees
              materially changed mid-term.
            </li>
          </ol>
        </section>

        <!-- IP -->
        <section class="doc-section">
          <h2>8. INTELLECTUAL PROPERTY RIGHTS</h2>
          <p>
            8.1. The Service Provider retains all right, title, and interest in its proprietary
            Platform.
          </p>
          <p>
            8.2. <strong class="client-highlight">{clientName}</strong> retains full ownership of its
            brand identity, logos, trademarks, event content, and all customer data collected through
            the Platform.
          </p>
        </section>

        <!-- Data -->
        <section class="doc-section">
          <h2>9. DATA OWNERSHIP AND COMMON DATA</h2>
          <p>
            9.1. <strong>Data Ownership.</strong> All data collected exclusively under
            <strong class="client-highlight">{clientName}</strong>'s brand shall be the sole and
            exclusive property of <strong class="client-highlight">{clientName}</strong>.
          </p>
          <p>
            9.2. <strong>Common Data.</strong> Data from users interacting through the Wagwan Ecosystem
            shall constitute "Common Data" jointly owned by both Parties.
          </p>
          <p>
            9.3. <strong>Confidentiality.</strong> Both Parties agree to maintain confidentiality of
            all Confidential Information for a period of <strong>two (2) years</strong> from termination.
          </p>
          <p>
            9.4. <strong>Data Security.</strong> The Service Provider shall implement appropriate technical
            and organizational security measures.
          </p>
          <p>
            9.5. <strong>Aggregated Data.</strong> The Service Provider may use anonymized and aggregated
            forms of Client Data for research and product improvement.
          </p>
          <p>
            9.6. <strong>Onboarding and Support.</strong> The Service Provider shall provide onboarding
            assistance and reasonable technical support.
          </p>
        </section>

        <!-- GST -->
        <section class="doc-section">
          <h2>10. GST AND INVOICING</h2>
          <p>
            10.1. The Service Provider shall issue a <strong>tax invoice</strong> on a
            monthly/yearly basis to <strong class="client-highlight">{clientName}</strong> with applicable
            GST.
          </p>
          <p>
            10.2. All amounts are <strong>exclusive of GST</strong> unless expressly stated otherwise.
          </p>
          <p>10.3. Both Parties shall comply with the <strong>GST Act, 2017</strong>.</p>
          <p>
            10.4. <strong class="client-highlight">{clientName}</strong> shall be entitled to claim
            <strong>input tax credit</strong> on GST paid.
          </p>
        </section>

        <!-- Indemnification -->
        <section class="doc-section">
          <h2>11. INDEMNIFICATION</h2>
          <p>
            11.1. <strong class="client-highlight">{clientName}</strong> agrees to indemnify, defend,
            and hold harmless the Service Provider from claims arising out of:
          </p>
          <ol class="clause-list" type="a">
            <li>
              Any breach of this Agreement by <strong class="client-highlight">{clientName}</strong
              >.
            </li>
            <li>
              Any negligence by <strong class="client-highlight">{clientName}</strong> in connection with
              Platform use.
            </li>
            <li>Any claims from Customers, including refunds or event cancellations.</li>
            <li>
              <strong class="client-highlight">{clientName}</strong>'s failure to comply with
              applicable tax or regulatory obligations.
            </li>
          </ol>
          <p>
            e) This indemnity shall <strong>not extend</strong> to liability arising from the Service
            Provider's own acts or compliance failures.
          </p>
          <p>
            f) Each Party shall remain individually responsible for its respective regulatory
            duties.
          </p>
        </section>

        <!-- Limitation of Liability -->
        <section class="doc-section">
          <h2>12. LIMITATION OF LIABILITY</h2>
          <p>
            12.1. Total aggregate liability shall not exceed the <strong
              >total revenue generated in the preceding three (3) calendar months</strong
            >.
          </p>
          <p>
            12.2. The liability cap is based on actual commissions and subscription revenues
            received from <strong class="client-highlight">{clientName}</strong>'s use of the
            Platform.
          </p>
          <p>
            12.3. The Service Provider shall not be liable for any indirect, consequential,
            incidental, punitive, or special damages.
          </p>
          <p>12.4. This limitation applies to all claims under this Agreement.</p>
          <p>
            12.5. In the event of gross negligence or fraud, <strong class="client-highlight"
              >{clientName}</strong
            >
            shall provide written notice within <strong>two (2) months</strong>. The Service
            Provider shall be granted a <strong>one (1) month rectification period</strong>.
          </p>
        </section>

        <!-- Force Majeure -->
        <section class="doc-section">
          <h2>13. FORCE MAJEURE</h2>
          <p>
            13.1. Neither Party shall be liable for failure due to events beyond reasonable control.
          </p>
          <p>13.2. The affected Party shall promptly notify the other in writing.</p>
          <p>
            13.3. If the Force Majeure Event continues for <strong
              >sixty (60) consecutive days</strong
            >, either Party may terminate upon written notice.
          </p>
        </section>

        <!-- Governing Law -->
        <section class="doc-section">
          <h2>14. GOVERNING LAW AND JURISDICTION</h2>
          <p>
            14.1. This Agreement shall be governed by the <strong>laws of India</strong>. The courts
            in <strong>Bangalore, Karnataka</strong> shall have exclusive jurisdiction.
          </p>
        </section>

        <!-- Dispute Resolution -->
        <section class="doc-section">
          <h2>15. DISPUTE RESOLUTION</h2>
          <p>
            15.1. Disputes shall be resolved by <strong>arbitration</strong> under the Arbitration and
            Conciliation Act, 1996.
          </p>
          <p>
            15.2. The arbitration shall be conducted by a <strong>sole arbitrator</strong> mutually appointed
            within fifteen (15) days.
          </p>
          <p>
            15.3. If parties cannot agree on an arbitrator, appointment shall follow Section 11 of
            the Act.
          </p>
          <p>
            15.4. Seat and venue: <strong>Bengaluru, Karnataka</strong>. Proceedings in
            <strong>English</strong>. Award shall be final and binding.
          </p>
        </section>

        <!-- Miscellaneous -->
        <section class="doc-section">
          <h2>16. MISCELLANEOUS</h2>
          <p>
            16.1. <strong>Entire Agreement:</strong> This Agreement constitutes the entire understanding
            between the Parties.
          </p>
          <p>
            16.2. <strong>Severability:</strong> If any provision is held invalid, the remaining provisions
            remain in full force.
          </p>
          <p>
            16.3. <strong>Waiver:</strong> No waiver of any term shall be deemed a continuing waiver.
          </p>
          <p>
            16.4. <strong>Notices:</strong> Any notice shall be in writing and sent to the registered
            office addresses.
          </p>
        </section>

        <!-- Signing Section -->
        <section class="doc-section signing-section">
          <h2>IN WITNESS WHEREOF</h2>
          <p>The Parties have executed this Agreement as of the date of digital signature below.</p>

          <div class="signing-grid">
            <div class="signing-party">
              <h3>Wagwan World LLP</h3>
              <div class="prefilled-field">
                <span class="field-label">Name</span><span class="field-value">Madhvik Nemani</span>
              </div>
              <div class="prefilled-field">
                <span class="field-label">Title</span><span class="field-value">Founder, CEO</span>
              </div>
              <div class="prefilled-field">
                <span class="field-label">Date</span><span class="field-value">{today}</span>
              </div>
              <div class="prefilled-field">
                <span class="field-label">Signature</span><span class="field-value signature-text"
                  >Madhvik Nemani</span
                >
              </div>
            </div>

            <div class="signing-party">
              <h3>For {clientName}</h3>
              <div class="prefilled-field">
                <span class="field-label">Name</span><span class="field-value">{name || '—'}</span>
              </div>
              <div class="prefilled-field">
                <span class="field-label">Company</span><span class="field-value"
                  >{company || '—'}</span
                >
              </div>
              <div class="prefilled-field">
                <span class="field-label">Date</span><span class="field-value">{today}</span>
              </div>
              <div class="prefilled-field">
                <span class="field-label">Signature</span>
                {#if signatureData}
                  <img src={signatureData} alt="Digital signature" class="signature-preview" />
                {:else}
                  <span class="field-value">—</span>
                {/if}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>

    <!-- Footer -->
    <footer class="agreement-footer">
      <p>
        This is a legally binding digital agreement. By signing, you acknowledge that your digital
        signature carries the same legal weight as a handwritten signature.
      </p>
      <p class="footer-copy">
        &copy; {new Date().getFullYear()} Wagwan World LLP. All rights reserved.
      </p>
    </footer>
  {/if}
</div>

<style>
  /* ── Base ── */
  .agreement-page {
    font-family:
      'Inter',
      -apple-system,
      BlinkMacSystemFont,
      sans-serif;
    background: #0f0f11;
    color: #ededef;
    min-height: 100vh;
    overflow-y: auto;
  }

  /* ── Header ── */
  .agreement-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(15, 15, 17, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .header-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 14px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .logo {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 1.5rem;
    font-weight: 700;
    color: #ededef;
    letter-spacing: -0.02em;
  }

  .header-tag {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #e8833a;
    background: rgba(232, 131, 58, 0.1);
    padding: 4px 12px;
    border-radius: 100px;
    border: 1px solid rgba(232, 131, 58, 0.2);
  }

  /* ── Sticky Form Sidebar ── */
  .form-sidebar {
    position: fixed;
    top: 53px;
    right: 0;
    width: 360px;
    height: calc(100vh - 53px);
    overflow-y: auto;
    padding: 24px 20px;
    z-index: 90;
    background: rgba(15, 15, 17, 0.6);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-left: 1px solid rgba(255, 255, 255, 0.06);
  }

  .form-card {
    position: sticky;
    top: 0;
  }

  .form-card h3 {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 1.25rem;
    font-weight: 600;
    color: #ededef;
    margin: 0 0 6px;
  }

  .form-desc {
    font-size: 0.8125rem;
    color: #8a8a90;
    line-height: 1.5;
    margin: 0 0 20px;
  }

  /* ── Form Fields ── */
  .form-field {
    margin-bottom: 16px;
  }

  .form-field label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: #8a8a90;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .form-field input[type='text'] {
    width: 100%;
    padding: 10px 12px;
    font-size: 0.875rem;
    font-family: 'Inter', sans-serif;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    color: #ededef;
    outline: none;
    transition: border-color 200ms;
    box-sizing: border-box;
  }

  .form-field input[type='text']:focus {
    border-color: #e8833a;
    box-shadow: 0 0 0 2px rgba(232, 131, 58, 0.15);
  }

  .form-field input[type='text']::placeholder {
    color: #4a4a50;
  }

  .field-hint {
    display: block;
    font-size: 0.6875rem;
    color: #e8833a;
    margin-top: 4px;
    opacity: 0.8;
  }

  .signature-actions {
    margin-top: 6px;
    display: flex;
    justify-content: flex-end;
  }

  .btn-clear {
    font-family: 'Inter', sans-serif;
    font-size: 0.75rem;
    color: #8a8a90;
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }

  .btn-clear:hover {
    color: #ededef;
  }

  /* ── Checkbox ── */
  .checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    cursor: pointer;
    margin-bottom: 16px;
  }

  .checkbox-label input[type='checkbox'] {
    margin-top: 2px;
    width: 15px;
    height: 15px;
    accent-color: #e8833a;
    cursor: pointer;
    flex-shrink: 0;
  }

  .checkbox-label span {
    font-size: 0.8125rem;
    line-height: 1.5;
    color: #8a8a90;
  }

  /* ── Submit ── */
  .btn-submit {
    width: 100%;
    padding: 12px 20px;
    font-family: 'Inter', sans-serif;
    font-size: 0.875rem;
    font-weight: 600;
    color: #0f0f11;
    background: #ededef;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 200ms;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn-submit:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-submit:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(15, 15, 17, 0.2);
    border-top-color: #0f0f11;
    border-radius: 50%;
    animation: spin 600ms linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Error ── */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(248, 113, 113, 0.1);
    border: 1px solid rgba(248, 113, 113, 0.2);
    border-radius: 8px;
    color: #f87171;
    font-size: 0.8125rem;
    margin-bottom: 16px;
  }

  /* ── Agreement Container ── */
  .agreement-container {
    max-width: 780px;
    margin: 0 auto;
    padding: 40px 24px 80px;
    padding-right: 400px;
  }

  .agreement-document {
    background: linear-gradient(175deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.006));
    border-radius: 14px;
    padding: 48px 48px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  }

  /* ── Document Styles ── */
  .doc-title-section {
    text-align: center;
    margin-bottom: 36px;
    padding-bottom: 28px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .doc-title {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    margin: 0 0 14px;
    color: #ededef;
  }

  .doc-subtitle {
    font-size: 0.875rem;
    color: #8a8a90;
    line-height: 1.7;
    max-width: 500px;
    margin: 0 auto;
  }

  .doc-section {
    margin-bottom: 24px;
  }

  .doc-section h2 {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 1rem;
    font-weight: 700;
    color: #ededef;
    margin: 0 0 10px;
    letter-spacing: 0.02em;
  }

  .doc-section p {
    font-size: 0.875rem;
    line-height: 1.75;
    color: #8a8a90;
    margin: 0 0 8px;
  }

  .and-divider {
    text-align: center;
    font-weight: 700;
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 1rem;
    margin: 16px 0;
    color: #ededef;
  }

  .party-note {
    font-style: italic;
    color: #4a4a50 !important;
  }

  .consideration-clause {
    text-align: center;
    font-size: 0.8125rem;
    line-height: 1.6;
    color: #ededef;
    margin: 28px 0;
    padding: 16px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  /* ── Dynamic client name highlight ── */
  :global(.client-highlight) {
    color: #e8833a;
    font-weight: 600;
  }

  /* ── Lists ── */
  .recitals-list,
  .clause-list {
    padding-left: 20px;
    margin: 6px 0 0;
  }

  .recitals-list li,
  .clause-list li {
    font-size: 0.875rem;
    line-height: 1.75;
    color: #8a8a90;
    margin-bottom: 8px;
  }

  .clause-sublist {
    padding-left: 18px;
    margin-top: 4px;
  }

  /* ── Definitions ── */
  .definitions-list {
    margin: 0;
  }

  .def-item {
    margin-bottom: 8px;
  }

  .def-item dt {
    font-weight: 600;
    font-size: 0.875rem;
    color: #ededef;
    display: inline;
  }

  .def-item dd {
    display: inline;
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.75;
    color: #8a8a90;
  }

  /* ── Signing Section ── */
  .signing-section {
    margin-top: 40px;
    padding-top: 32px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .signing-section h2 {
    font-size: 1.125rem;
    text-align: center;
    margin-bottom: 6px;
  }

  .signing-section > p {
    text-align: center;
    margin-bottom: 28px;
  }

  .signing-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }

  .signing-party h3 {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 16px;
    color: #ededef;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .prefilled-field {
    margin-bottom: 10px;
  }

  .field-label {
    display: block;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #4a4a50;
    margin-bottom: 2px;
  }

  .field-value {
    font-size: 0.875rem;
    color: #ededef;
  }

  .signature-text {
    font-family: 'EB Garamond', Georgia, serif;
    font-style: italic;
    font-size: 1.25rem;
    color: #ededef;
  }

  .signature-preview {
    max-width: 160px;
    height: 48px;
    object-fit: contain;
    filter: invert(1);
  }

  /* ── Success ── */
  .success-container {
    max-width: 480px;
    margin: 0 auto;
    padding: 80px 24px;
  }

  .success-card {
    background: linear-gradient(175deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.006));
    border-radius: 14px;
    padding: 44px 36px;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .success-icon {
    margin-bottom: 16px;
  }

  .success-card h1 {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 1.375rem;
    color: #ededef;
    margin: 0 0 10px;
  }

  .success-card > p {
    font-size: 0.875rem;
    color: #8a8a90;
    line-height: 1.6;
    margin: 0 0 24px;
  }

  .success-details {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    padding: 16px;
    text-align: left;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .detail-label {
    font-size: 0.75rem;
    color: #4a4a50;
    font-weight: 600;
  }

  .detail-value {
    font-size: 0.8125rem;
    color: #ededef;
  }

  /* ── Footer ── */
  .agreement-footer {
    max-width: 780px;
    margin: 0 auto;
    padding: 20px 24px 40px;
    padding-right: 400px;
    text-align: center;
  }

  .agreement-footer p {
    font-size: 0.6875rem;
    color: #4a4a50;
    line-height: 1.6;
    margin: 0 0 4px;
  }

  .footer-copy {
    color: #2a2a30;
  }

  /* ── Mobile ── */
  @media (max-width: 900px) {
    .form-sidebar {
      position: relative;
      top: 0;
      width: 100%;
      height: auto;
      border-left: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding: 20px 16px;
    }

    .form-card {
      position: static;
    }

    .agreement-container {
      padding: 24px 16px 60px;
      padding-right: 16px;
    }

    .agreement-document {
      padding: 28px 20px;
    }

    .agreement-footer {
      padding-right: 16px;
    }

    .signing-grid {
      grid-template-columns: 1fr;
      gap: 24px;
    }
  }
</style>
