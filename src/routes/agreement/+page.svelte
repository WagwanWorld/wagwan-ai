<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount, onDestroy } from 'svelte';
  import SignaturePad from '$lib/components/SignaturePad.svelte';
  import { generateAgreementPdf } from '$lib/utils/agreementPdf';

  let { form } = $props();

  let name = $state(form?.name ?? '');
  let company = $state(form?.company ?? '');
  let signatureData = $state<string | null>(null);
  let signaturePad: SignaturePad;
  let submitting = $state(false);
  let agreed = $state(false);
  let showForm = $state(false);

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

  onMount(() => {
    // Override the global overflow: hidden on html/body so this page scrolls
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
  });

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
    }
  });
</script>

<svelte:head>
  <title>Service Agreement - Wagwan World LLP</title>
  <meta
    name="description"
    content="Digital Service Agreement between Wagwan World LLP and Client"
  />
  <meta name="robots" content="noindex, nofollow" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="ag-page">
  <!-- Header -->
  <header class="ag-header">
    <div class="ag-header-inner">
      <img src="/wagwan-logo-white.svg" alt="Wagwan" class="ag-logo" />
      <div class="ag-header-right">
        <span class="ag-badge">Service Agreement</span>
        <!-- Mobile: toggle form -->
        <button class="ag-form-toggle" onclick={() => (showForm = !showForm)}>
          {showForm ? 'View Contract' : 'Sign Now'}
        </button>
      </div>
    </div>
  </header>

  {#if form?.success}
    <main class="ag-success-wrap">
      <div class="ag-success-card">
        <svg
          class="ag-success-icon"
          width="52"
          height="52"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#4ade80"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <h1>Agreement Signed</h1>
        <p>Thank you, <strong>{form.name}</strong>. Your signed agreement has been recorded.</p>
        <div class="ag-success-meta">
          <div><span>Signed by</span><strong>{form.name}</strong></div>
          <div><span>Company</span><strong>{form.company}</strong></div>
          <div><span>Date</span><strong>{today}</strong></div>
        </div>
        <button
          class="ag-download"
          onclick={() =>
            generateAgreementPdf({
              signerName: form.name,
              companyName: form.company,
              signatureDataUrl: form.signature ?? null,
              date: today,
            })}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
              points="7 10 12 15 17 10"
            /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download PDF
        </button>
      </div>
    </main>
  {:else}
    <div class="ag-layout">
      <!-- Contract -->
      <main class="ag-contract" class:ag-hidden-mobile={showForm}>
        <div class="ag-doc">
          <div class="ag-doc-head">
            <img src="/wagwan-logo-white.svg" alt="Wagwan" class="ag-doc-logo" />
            <h1>SERVICE AGREEMENT</h1>
            <p>
              This Service Agreement (hereinafter referred to as the "Agreement") is made and
              entered into on the date of digital execution below, by and between:
            </p>
          </div>

          <section class="ag-sec">
            <h2>BETWEEN:</h2>
            <p>
              <strong>Wagwan World LLP</strong>, a company incorporated under the Companies Act,
              2013, having its registered office at 672 Ferns Paradise, 4th Street, Doddaanakundi,
              Bangalore, Karnataka, India, 560037 (hereinafter referred to as the "<strong
                >Service Provider</strong
              >" or "<strong>Wagwan</strong>", which expression shall, unless repugnant to the
              context or meaning thereof, be deemed to mean and include its successors and permitted
              assigns) of the <strong>FIRST PART</strong>;
            </p>
            <p class="ag-and">AND</p>
            <p>
              <strong class="ag-client">{clientName}</strong>, (hereinafter referred to as the "<strong
                >Client</strong
              >", which expression shall, unless repugnant to the context or meaning thereof, be
              deemed to mean and include its proprietors, partners, successors, and permitted
              assigns) of the <strong>SECOND PART</strong>.
            </p>
            <p class="ag-muted-italic">
              (The Service Provider and the Client shall hereinafter be individually referred to as
              a "Party" and collectively as "Parties".)
            </p>
          </section>

          <section class="ag-sec">
            <h2>RECITALS</h2>
            <ol>
              <li>
                The Service Provider is engaged in the business of owning, operating, and managing
                various forms of accommodation and hospitality ventures, including but not limited
                to hotels, long-stay rental accommodations, paying guest services, and restaurants.
                In furtherance of its business, the Service Provider has developed and owns a
                proprietary web-based event and community management software platform (the
                "Platform").
              </li>
              <li>
                <strong class="ag-client">{clientName}</strong> is engaged in the business of operating
                a premium nightlife and entertainment venue and wishes to utilize the Service Provider's
                Platform for its operational needs.
              </li>
              <li>
                The Service Provider has agreed to grant <strong class="ag-client"
                  >{clientName}</strong
                >
                a non-exclusive, non-transferable license to access and use the Platform, and
                <strong class="ag-client">{clientName}</strong> has agreed to avail the services in accordance
                with the terms and conditions set forth in this Agreement.
              </li>
            </ol>
          </section>

          <div class="ag-clause-box">
            <strong
              >NOW, THEREFORE, IN CONSIDERATION OF THE MUTUAL COVENANTS AND AGREEMENTS HEREIN
              CONTAINED, THE PARTIES HERETO AGREE AS FOLLOWS:</strong
            >
          </div>

          <section class="ag-sec">
            <h2>1. DEFINITIONS</h2>
            <p>
              <strong>1.1. "Business Day"</strong> means any day other than Saturday, Sunday, or a public
              holiday in Bengaluru, India.
            </p>
            <p>
              <strong>1.2. "Confidential Information"</strong> means any and all information, whether
              oral, written, or in any other form, disclosed by one Party to the other, including but
              not limited to customer data, financial information, business strategies, and technical
              data related to the Platform.
            </p>
            <p>
              <strong>1.3. "Customer"</strong> means any individual who purchases tickets, pays
              cover charges, or otherwise engages with
              <strong class="ag-client">{clientName}</strong>'s services through the Platform.
            </p>
            <p>
              <strong>1.4. "Effective Date"</strong> means the date of digital execution on which this
              Agreement becomes effective.
            </p>
            <p>
              <strong>1.5. "Platform"</strong> means the Service Provider's proprietary web-based software,
              including all its modules, features, and functionalities as described in Clause 2.
            </p>
            <p>
              <strong>1.6. "Service Fees"</strong> means the fees payable by
              <strong class="ag-client">{clientName}</strong> to the Service Provider as detailed in Clause
              5.
            </p>
          </section>

          <section class="ag-sec">
            <h2>2. SCOPE OF SERVICES</h2>
            <p>
              2.1. The Service Provider shall provide <strong class="ag-client">{clientName}</strong
              > with access to its Platform, which includes the following features and services:
            </p>
            <ol type="a">
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
                maintain digital communities of <strong class="ag-client">{clientName}</strong>'s
                patrons.
              </li>
              <li>
                <strong>Admin Dashboard:</strong> A centralized administrative panel for managing events,
                monitoring payments, accessing guest data, and reviewing analytics.
              </li>
              <li>
                <strong>Communication Tools:</strong> Integrated utilities for sending promotional and
                informational messages to attendees and community members via WhatsApp and Email.
              </li>
              <li>
                The Service Provider shall ensure that the Platform remains operational and
                accessible at least <strong>ninety-seven percent (97%)</strong> of the time in any given
                calendar month, excluding scheduled maintenance and force majeure events.
              </li>
              <li>
                In the event that Platform uptime falls below the guaranteed threshold, <strong
                  class="ag-client">{clientName}</strong
                >
                shall be entitled to <strong>service credits or monetary adjustments</strong> in accordance
                with Clause 10.2.
              </li>
              <li>
                The uptime performance shall be measured monthly, and all claims for service credits
                must be made in writing.
              </li>
              <li>
                <strong class="ag-client">{clientName}</strong> shall have the right to
                <strong>reconcile and review all transaction data</strong>
                generated through the Platform on a monthly basis. Upon written request, the Service Provider
                shall provide detailed transaction reports within
                <strong>five (5) business days</strong>.
              </li>
              <li>
                <strong class="ag-client">{clientName}</strong> may verify the accuracy of Platform-reported
                data against its internal records, and both Parties shall cooperate in good faith to resolve
                any discrepancies.
              </li>
              <li>
                <strong class="ag-client">{clientName}</strong>'s review rights under this clause
                shall be limited to <strong>financial and transactional data</strong> relevant to its
                own account.
              </li>
            </ol>
          </section>

          <section class="ag-sec">
            <h2>3. TERM OF AGREEMENT</h2>
            <p>
              This Agreement shall remain in full force and effect for a period of <strong
                >three (3) years</strong
              >
              from the Effective Date, unless terminated earlier. Upon expiry, the Agreement may be renewed
              by <strong>mutual written consent</strong>.
            </p>
          </section>

          <section class="ag-sec">
            <h2>4. OBLIGATIONS OF THE CLIENT</h2>
            <p>
              4.1. <strong class="ag-client">{clientName}</strong> shall be solely responsible for the
              accuracy, quality, and legality of all content, data, and information related to its events
              and services.
            </p>
            <p>
              4.2. <strong class="ag-client">{clientName}</strong> shall be the "seller of record" for
              all transactions processed through the Platform. The Service Provider acts merely as a technology
              facilitator.
            </p>
            <p>
              4.3. <strong class="ag-client">{clientName}</strong> shall ensure timely payment of all
              fees and charges as stipulated in this Agreement.
            </p>
            <p>
              4.4. <strong class="ag-client">{clientName}</strong> shall be solely responsible for all
              customer service, inquiries, disputes, and communications related to its events and offerings.
            </p>
          </section>

          <section class="ag-sec">
            <h2>5. FINANCIAL TERMS AND PAYMENT</h2>
            <p>
              5.1. <strong>Product Fee:</strong> <strong class="ag-client">{clientName}</strong>
              shall pay a yearly minimum fee of <strong>INR 10,000</strong> for the continued use of the
              Platform.
            </p>
            <p>5.2. <strong>Service Charges:</strong></p>
            <ol>
              <li>
                The Service Provider shall levy a <strong>5% service charge</strong> on the value of all
                cover charges processed through the platform per month, offloaded to the consumer.
              </li>
              <li>
                The Service Provider shall levy a service charge of <strong>5%</strong> on the value of
                all ticket payments processed through the platform, offloaded to the consumer.
              </li>
              <li>
                After an initial period of six (6) months, the Parties may review the commission
                structure. Any revision shall require <strong>mutual written agreement</strong>. The
                total commission shall <strong>not exceed twenty percent (20%)</strong> of the total transaction
                value.
              </li>
            </ol>
            <p>
              5.3. <strong>Pass-Through Costs:</strong> All service charges, payment gateway fees, and
              GST shall be offloaded to the Customer at the point of sale.
            </p>
            <p>
              5.4. <strong>Payouts:</strong> All funds collected on behalf of
              <strong class="ag-client">{clientName}</strong>, net of fees, shall be remitted within
              <strong>1 to 5 business days</strong>.
            </p>
            <p>
              5.5. In the event of payment default, the Service Provider shall provide a <strong
                >seven (7) day grace period</strong
              >. Failure to pay within this period allows suspension of Platform access.
            </p>
            <p>
              5.6. Upon receipt of all outstanding payments, access shall be reinstated within <strong
                >two (2) business days</strong
              >.
            </p>
          </section>

          <section class="ag-sec">
            <h2>6. REFUNDS, CHARGEBACKS, AND LIABILITY</h2>
            <p>
              6.1. The Service Provider shall facilitate refund requests as a <strong
                >technical and operational function only</strong
              >.
            </p>
            <p>
              6.2. <strong class="ag-client">{clientName}</strong> shall remain
              <strong>solely and exclusively responsible</strong> for funding and approving all customer
              refunds.
            </p>
            <p>
              6.3. If a refund arises solely due to a technical error attributable to the Platform,
              the Service Provider shall bear only the associated <strong
                >processing fees and chargeback fees</strong
              >.
            </p>
            <p>
              6.4. The Service Provider's liability is limited to <strong>refund fees only</strong>.
            </p>
            <p>
              6.5. <strong class="ag-client">{clientName}</strong> shall bear full responsibility
              for chargebacks. For verified technical errors, Wagwan shall reimburse chargeback fees
              within <strong>fifteen (15) business days</strong>.
            </p>
            <p>
              6.6. All service fees, subscription fees, and platform charges are <strong
                >non-refundable</strong
              >.
            </p>
            <p>
              6.7. The Service Provider shall not be liable for disputes arising from non-technical
              issues.
            </p>
            <p>
              6.8. Both Parties shall cooperate in good faith to resolve refund or chargeback
              matters.
            </p>
          </section>

          <section class="ag-sec">
            <h2>7. TERM AND TERMINATION</h2>
            <p>
              7.1. This Agreement shall commence on the Effective Date and remain in effect for <strong
                >three (3) years</strong
              >.
            </p>
            <p>
              7.2. Either Party may terminate with <strong>30 days' prior written notice</strong>.
            </p>
            <p>
              7.3. Upon termination: <strong class="ag-client">{clientName}</strong> shall cease
              Platform use and clear outstanding dues. The Service Provider shall provide all
              <strong>raw Client Data</strong>
              within <strong>fifteen (15) business days</strong>.
            </p>
          </section>

          <section class="ag-sec">
            <h2>8. INTELLECTUAL PROPERTY RIGHTS</h2>
            <p>8.1. The Service Provider retains all rights in its proprietary Platform.</p>
            <p>
              8.2. <strong class="ag-client">{clientName}</strong> retains full ownership of its brand
              identity, logos, trademarks, event content, and all customer data collected through the
              Platform.
            </p>
          </section>

          <section class="ag-sec">
            <h2>9. DATA OWNERSHIP AND COMMON DATA</h2>
            <p>
              9.1. All data collected exclusively under <strong class="ag-client"
                >{clientName}</strong
              >'s brand shall be the sole property of
              <strong class="ag-client">{clientName}</strong>.
            </p>
            <p>
              9.2. Data from users interacting through the Wagwan Ecosystem shall constitute "Common
              Data" jointly owned by both Parties.
            </p>
            <p>
              9.3. Both Parties agree to maintain confidentiality for <strong>two (2) years</strong> from
              termination.
            </p>
            <p>
              9.4. The Service Provider shall implement appropriate technical and organizational
              security measures.
            </p>
            <p>
              9.5. The Service Provider may use anonymized and aggregated forms of Client Data for
              research and product improvement.
            </p>
            <p>
              9.6. The Service Provider shall provide onboarding assistance and reasonable technical
              support.
            </p>
          </section>

          <section class="ag-sec">
            <h2>10. GST AND INVOICING</h2>
            <p>
              10.1. The Service Provider shall issue a <strong>tax invoice</strong> on a monthly/yearly
              basis with applicable GST.
            </p>
            <p>
              10.2. All amounts are <strong>exclusive of GST</strong> unless expressly stated otherwise.
            </p>
            <p>10.3. Both Parties shall comply with the <strong>GST Act, 2017</strong>.</p>
            <p>
              10.4. <strong class="ag-client">{clientName}</strong> shall be entitled to claim
              <strong>input tax credit</strong> on GST paid.
            </p>
          </section>

          <section class="ag-sec">
            <h2>11. INDEMNIFICATION</h2>
            <p>
              11.1. <strong class="ag-client">{clientName}</strong> agrees to indemnify and hold harmless
              the Service Provider from claims arising out of: breach of this Agreement, negligence in
              Platform use, Customer claims including refunds or event cancellations, and failure to comply
              with tax or regulatory obligations.
            </p>
            <p>
              11.2. This indemnity shall <strong>not extend</strong> to liability arising from the Service
              Provider's own acts or compliance failures.
            </p>
          </section>

          <section class="ag-sec">
            <h2>12. LIMITATION OF LIABILITY</h2>
            <p>
              12.1. Total aggregate liability shall not exceed the <strong
                >total revenue generated in the preceding three (3) calendar months</strong
              >.
            </p>
            <p>
              12.2. The Service Provider shall not be liable for any indirect, consequential,
              incidental, punitive, or special damages.
            </p>
            <p>
              12.3. In the event of gross negligence or fraud, <strong class="ag-client"
                >{clientName}</strong
              >
              shall provide written notice within <strong>two (2) months</strong>. A
              <strong>one (1) month rectification period</strong> shall be granted.
            </p>
          </section>

          <section class="ag-sec">
            <h2>13. FORCE MAJEURE</h2>
            <p>
              13.1. Neither Party shall be liable for failure due to events beyond reasonable
              control.
            </p>
            <p>
              13.2. If the Force Majeure Event continues for <strong
                >sixty (60) consecutive days</strong
              >, either Party may terminate upon written notice.
            </p>
          </section>

          <section class="ag-sec">
            <h2>14. GOVERNING LAW AND JURISDICTION</h2>
            <p>
              14.1. This Agreement shall be governed by the <strong>laws of India</strong>. The
              courts in <strong>Bangalore, Karnataka</strong> shall have exclusive jurisdiction.
            </p>
          </section>

          <section class="ag-sec">
            <h2>15. DISPUTE RESOLUTION</h2>
            <p>
              15.1. Disputes shall be resolved by <strong>arbitration</strong> under the Arbitration
              and Conciliation Act, 1996, conducted by a <strong>sole arbitrator</strong> mutually appointed
              within fifteen (15) days.
            </p>
            <p>
              15.2. Seat and venue: <strong>Bengaluru, Karnataka</strong>. Proceedings in
              <strong>English</strong>. Award shall be final and binding.
            </p>
          </section>

          <section class="ag-sec">
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

          <!-- Signing Preview -->
          <section class="ag-sec ag-sign-section">
            <h2>IN WITNESS WHEREOF</h2>
            <p>
              The Parties have executed this Agreement as of the date of digital signature below.
            </p>
            <div class="ag-sign-grid">
              <div class="ag-sign-party">
                <h3>Wagwan World LLP</h3>
                <div class="ag-field"><span>Name</span><strong>Madhvik Nemani</strong></div>
                <div class="ag-field"><span>Title</span><strong>Founder, CEO</strong></div>
                <div class="ag-field"><span>Date</span><strong>{today}</strong></div>
                <div class="ag-field">
                  <span>Signature</span><em class="ag-sig-text">Madhvik Nemani</em>
                </div>
              </div>
              <div class="ag-sign-party">
                <h3>For {clientName}</h3>
                <div class="ag-field"><span>Name</span><strong>{name || '---'}</strong></div>
                <div class="ag-field"><span>Company</span><strong>{company || '---'}</strong></div>
                <div class="ag-field"><span>Date</span><strong>{today}</strong></div>
                <div class="ag-field">
                  <span>Signature</span>
                  {#if signatureData}
                    <img src={signatureData} alt="Signature" class="ag-sig-img" />
                  {:else}
                    <strong>---</strong>
                  {/if}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <!-- Form Panel -->
      <aside class="ag-form-panel" class:ag-show-mobile={showForm}>
        <div class="ag-form-inner">
          <h3>Sign this Agreement</h3>
          <p>
            Fill in your details and sign below. Your company name will appear throughout the
            contract.
          </p>

          {#if form?.error}
            <div class="ag-error">{form.error}</div>
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
            <div class="ag-input-group">
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

            <div class="ag-input-group">
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
                <span class="ag-hint">Appears as the Client throughout the agreement</span>
              {/if}
            </div>

            <div class="ag-input-group">
              <label>Digital Signature</label>
              <SignaturePad bind:this={signaturePad} onSignatureChange={handleSignatureChange} />
              <button type="button" class="ag-clear-btn" onclick={clearSignature}>Clear</button>
              <input type="hidden" name="signature" value={signatureData ?? ''} />
            </div>

            <label class="ag-check">
              <input type="checkbox" bind:checked={agreed} required />
              <span>I have read and agree to the terms of this Service Agreement.</span>
            </label>

            <button
              type="submit"
              class="ag-submit"
              disabled={submitting || !name || !company || !signatureData || !agreed}
            >
              {#if submitting}
                <span class="ag-spinner"></span> Signing...
              {:else}
                Sign Agreement
              {/if}
            </button>
          </form>
        </div>
      </aside>
    </div>

    <footer class="ag-footer">
      <p>
        This is a legally binding digital agreement. Your digital signature carries the same legal
        weight as a handwritten signature.
      </p>
      <p>&copy; {new Date().getFullYear()} Wagwan World LLP</p>
    </footer>
  {/if}
</div>

<style>
  /* ═══ RESET for this page ═══ */
  :global(html),
  :global(body) {
    overflow: auto !important;
    height: auto !important;
  }

  /* ═══ PAGE ═══ */
  .ag-page {
    font-family:
      'Inter',
      -apple-system,
      BlinkMacSystemFont,
      sans-serif;
    background: #0f0f11;
    color: #ededef;
    min-height: 100vh;
    font-size: 15px;
    line-height: 1.7;
  }

  /* ═══ HEADER ═══ */
  .ag-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(15, 15, 17, 0.88);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .ag-header-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 10px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ag-logo {
    height: 22px;
    width: auto;
  }
  .ag-header-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ag-badge {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #e8833a;
    background: rgba(232, 131, 58, 0.1);
    padding: 3px 10px;
    border-radius: 100px;
    border: 1px solid rgba(232, 131, 58, 0.15);
  }
  .ag-form-toggle {
    display: none;
    font-family: 'Inter', sans-serif;
    font-size: 0.75rem;
    font-weight: 600;
    color: #0f0f11;
    background: #ededef;
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    cursor: pointer;
  }

  /* ═══ LAYOUT ═══ */
  .ag-layout {
    display: flex;
    max-width: 1280px;
    margin: 0 auto;
    min-height: calc(100vh - 43px);
  }
  .ag-contract {
    flex: 1;
    min-width: 0;
    padding: 32px 24px 80px;
  }
  .ag-form-panel {
    width: 340px;
    flex-shrink: 0;
    border-left: 1px solid rgba(255, 255, 255, 0.06);
    padding: 24px 20px;
    position: sticky;
    top: 43px;
    height: calc(100vh - 43px);
    overflow-y: auto;
  }

  /* ═══ DOCUMENT ═══ */
  .ag-doc {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 40px 36px;
    max-width: 720px;
  }
  .ag-doc-head {
    text-align: center;
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .ag-doc-logo {
    height: 28px;
    margin-bottom: 20px;
    opacity: 0.5;
  }
  .ag-doc-head h1 {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    margin: 0 0 12px;
  }
  .ag-doc-head p {
    font-size: 0.8125rem;
    color: #8a8a90;
    max-width: 440px;
    margin: 0 auto;
  }

  /* ═══ SECTIONS ═══ */
  .ag-sec {
    margin-bottom: 20px;
  }
  .ag-sec h2 {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 0.9375rem;
    font-weight: 700;
    color: #ededef;
    margin: 0 0 8px;
    letter-spacing: 0.02em;
  }
  .ag-sec p {
    font-size: 0.8125rem;
    line-height: 1.75;
    color: #8a8a90;
    margin: 0 0 6px;
  }
  .ag-sec ol {
    padding-left: 18px;
    margin: 4px 0 0;
  }
  .ag-sec ol li {
    font-size: 0.8125rem;
    line-height: 1.75;
    color: #8a8a90;
    margin-bottom: 6px;
  }
  .ag-and {
    text-align: center;
    font-weight: 700;
    font-family: 'EB Garamond', Georgia, serif;
    color: #ededef !important;
    margin: 14px 0 !important;
  }
  .ag-muted-italic {
    font-style: italic;
    color: #4a4a50 !important;
  }
  .ag-clause-box {
    text-align: center;
    font-size: 0.75rem;
    color: #ededef;
    margin: 24px 0;
    padding: 14px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    line-height: 1.6;
  }

  /* Client name highlight */
  .ag-client {
    color: #e8833a;
    font-weight: 600;
  }

  /* ═══ SIGNING SECTION ═══ */
  .ag-sign-section {
    margin-top: 36px;
    padding-top: 28px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .ag-sign-section h2 {
    text-align: center;
    font-size: 1.0625rem;
    margin-bottom: 4px;
  }
  .ag-sign-section > p {
    text-align: center;
    margin-bottom: 24px !important;
  }
  .ag-sign-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .ag-sign-party h3 {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 0.9375rem;
    font-weight: 600;
    margin: 0 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .ag-field {
    margin-bottom: 8px;
  }
  .ag-field span {
    display: block;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #4a4a50;
    margin-bottom: 1px;
  }
  .ag-field strong {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #ededef;
  }
  .ag-sig-text {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 1.125rem;
    color: #ededef;
  }
  .ag-sig-img {
    max-width: 140px;
    height: 40px;
    object-fit: contain;
    filter: invert(1);
  }

  /* ═══ FORM PANEL ═══ */
  .ag-form-inner h3 {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 4px;
  }
  .ag-form-inner > p {
    font-size: 0.75rem;
    color: #8a8a90;
    margin: 0 0 20px;
    line-height: 1.5;
  }
  .ag-input-group {
    margin-bottom: 14px;
  }
  .ag-input-group label {
    display: block;
    font-size: 0.6875rem;
    font-weight: 600;
    color: #8a8a90;
    margin-bottom: 5px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .ag-input-group input[type='text'] {
    width: 100%;
    padding: 9px 11px;
    font-size: 0.8125rem;
    font-family: 'Inter', sans-serif;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.04);
    color: #ededef;
    outline: none;
    transition: border-color 200ms;
    box-sizing: border-box;
  }
  .ag-input-group input[type='text']:focus {
    border-color: #e8833a;
    box-shadow: 0 0 0 2px rgba(232, 131, 58, 0.12);
  }
  .ag-input-group input[type='text']::placeholder {
    color: #4a4a50;
  }
  .ag-hint {
    display: block;
    font-size: 0.625rem;
    color: #e8833a;
    margin-top: 3px;
    opacity: 0.7;
  }
  .ag-clear-btn {
    font-family: 'Inter', sans-serif;
    font-size: 0.6875rem;
    color: #8a8a90;
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: underline;
    padding: 4px 0;
    display: block;
    margin-left: auto;
  }
  .ag-clear-btn:hover {
    color: #ededef;
  }

  .ag-check {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    cursor: pointer;
    margin-bottom: 14px;
  }
  .ag-check input[type='checkbox'] {
    margin-top: 2px;
    width: 14px;
    height: 14px;
    accent-color: #e8833a;
    cursor: pointer;
    flex-shrink: 0;
  }
  .ag-check span {
    font-size: 0.75rem;
    line-height: 1.4;
    color: #8a8a90;
  }

  .ag-submit {
    width: 100%;
    padding: 10px 18px;
    font-family: 'Inter', sans-serif;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #0f0f11;
    background: #ededef;
    border: none;
    border-radius: 7px;
    cursor: pointer;
    transition: opacity 200ms;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .ag-submit:hover:not(:disabled) {
    opacity: 0.9;
  }
  .ag-submit:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .ag-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(15, 15, 17, 0.2);
    border-top-color: #0f0f11;
    border-radius: 50%;
    animation: agspin 600ms linear infinite;
  }
  @keyframes agspin {
    to {
      transform: rotate(360deg);
    }
  }

  .ag-error {
    padding: 8px 10px;
    background: rgba(248, 113, 113, 0.1);
    border: 1px solid rgba(248, 113, 113, 0.2);
    border-radius: 6px;
    color: #f87171;
    font-size: 0.75rem;
    margin-bottom: 14px;
  }

  /* ═══ SUCCESS ═══ */
  .ag-success-wrap {
    max-width: 440px;
    margin: 0 auto;
    padding: 80px 20px;
  }
  .ag-success-card {
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    padding: 40px 28px;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }
  .ag-success-icon {
    margin-bottom: 14px;
  }
  .ag-success-card h1 {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 1.25rem;
    margin: 0 0 8px;
  }
  .ag-success-card > p {
    font-size: 0.8125rem;
    color: #8a8a90;
    margin: 0 0 20px;
  }
  .ag-success-meta {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    padding: 14px;
    text-align: left;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }
  .ag-success-meta div {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    font-size: 0.8125rem;
  }
  .ag-success-meta div:last-child {
    border-bottom: none;
  }
  .ag-success-meta span {
    color: #4a4a50;
    font-size: 0.75rem;
  }

  /* ═══ DOWNLOAD BTN ═══ */
  .ag-download {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    margin-top: 16px;
    padding: 11px 20px;
    font-family: 'Inter', sans-serif;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #ededef;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    cursor: pointer;
    transition: background 200ms;
  }
  .ag-download:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  /* ═══ PRINT ═══ */
  @media print {
    .ag-page {
      background: #fff !important;
      color: #000 !important;
    }
    .ag-header,
    .ag-form-toggle,
    .ag-download,
    .ag-footer {
      display: none !important;
    }
    .ag-success-wrap {
      padding: 20px !important;
    }
    .ag-success-card {
      background: #fff !important;
      border: 1px solid #ddd !important;
      color: #000 !important;
    }
    .ag-success-card h1,
    .ag-success-card p,
    .ag-success-meta div,
    .ag-success-meta strong {
      color: #000 !important;
    }
    .ag-success-meta {
      background: #f9f9f9 !important;
      border: 1px solid #ddd !important;
    }
    .ag-success-meta span {
      color: #666 !important;
    }
    .ag-success-icon {
      filter: none;
    }

    /* If contract is visible behind success, also style it for print */
    .ag-doc {
      background: #fff !important;
      border: 1px solid #ddd !important;
      color: #000 !important;
    }
    .ag-sec h2 {
      color: #000 !important;
    }
    .ag-sec p,
    .ag-sec ol li {
      color: #333 !important;
    }
    .ag-client {
      color: #c05000 !important;
    }
    .ag-sign-party h3 {
      color: #000 !important;
      border-color: #ddd !important;
    }
    .ag-field span {
      color: #666 !important;
    }
    .ag-field strong,
    .ag-sig-text {
      color: #000 !important;
    }
    .ag-sig-img {
      filter: none !important;
    }
    .ag-form-panel {
      display: none !important;
    }
  }

  /* ═══ FOOTER ═══ */
  .ag-footer {
    max-width: 720px;
    margin: 0 auto;
    padding: 16px 24px 32px;
    text-align: center;
  }
  .ag-footer p {
    font-size: 0.625rem;
    color: #4a4a50;
    margin: 0 0 2px;
    line-height: 1.6;
  }

  /* ═══ MOBILE ═══ */
  @media (max-width: 768px) {
    .ag-form-toggle {
      display: block;
    }

    .ag-layout {
      flex-direction: column;
    }

    .ag-contract {
      padding: 20px 14px 40px;
    }

    .ag-doc {
      padding: 24px 18px;
    }

    .ag-doc-head h1 {
      font-size: 1.25rem;
    }

    .ag-form-panel {
      display: none;
      width: 100%;
      border-left: none;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      position: static;
      height: auto;
    }

    .ag-form-panel.ag-show-mobile {
      display: block;
    }

    .ag-hidden-mobile {
      display: none;
    }

    .ag-sign-grid {
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .ag-badge {
      display: none;
    }
  }

  /* Tablet */
  @media (min-width: 769px) and (max-width: 1024px) {
    .ag-form-panel {
      width: 300px;
    }
    .ag-doc {
      padding: 32px 28px;
    }
  }
</style>
