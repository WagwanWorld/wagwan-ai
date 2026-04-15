<script lang="ts">
  import { page } from '$app/stores';

  $: code = $page.url.searchParams.get('code');
</script>

<div class="del-page">
  <div class="del-card">
    <h1 class="del-title">Data Deletion</h1>

    {#if code}
      <div class="del-status">
        <div class="del-check">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="var(--accent-primary, #FF4D4D)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <p class="del-text">Your data deletion request has been received.</p>
        <p class="del-code">Confirmation code: <strong>{code}</strong></p>
        <p class="del-note">All personal data associated with your account will be permanently deleted within 90 days. This includes your profile, connected social accounts, and identity graph data.</p>
      </div>
    {:else}
      <div class="del-info">
        <h2 class="del-subtitle">How to delete your data</h2>
        <p class="del-text">If you want to delete all data Wagwan has collected about you, you have two options:</p>

        <div class="del-option">
          <h3>Option 1: Remove from Instagram</h3>
          <ol>
            <li>Go to your Instagram Settings</li>
            <li>Navigate to Security → Apps and Websites</li>
            <li>Find "Wagwan World" and tap Remove</li>
            <li>We'll automatically receive a deletion request and remove all your data</li>
          </ol>
        </div>

        <div class="del-option">
          <h3>Option 2: Email us</h3>
          <p>Send an email to <a href="mailto:madhviknem@gmail.com">madhviknem@gmail.com</a> with the subject "Data Deletion Request" and we'll process it within 48 hours.</p>
        </div>

        <p class="del-note">When your data is deleted, the following will be permanently removed: your profile information, connected social account data, identity graph, content analysis, and any campaign participation history.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .del-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--bg-primary, #0a0a0f);
    color: var(--text-primary, #e8ecf3);
  }

  .del-card {
    max-width: 520px;
    width: 100%;
  }

  .del-title {
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 0 0 32px;
  }

  .del-subtitle {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 12px;
  }

  .del-status {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .del-check {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(255, 77, 77, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .del-text {
    font-size: 15px;
    line-height: 1.6;
    color: var(--text-secondary, #9aa3b2);
    margin: 0;
  }

  .del-code {
    font-size: 13px;
    color: var(--text-muted, #6d7684);
    margin: 0;
    font-family: monospace;
  }

  .del-note {
    font-size: 13px;
    color: var(--text-muted, #6d7684);
    line-height: 1.6;
    margin: 24px 0 0;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .del-info {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .del-option {
    padding: 16px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  .del-option h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 8px;
  }

  .del-option ol {
    margin: 0;
    padding-left: 20px;
    font-size: 14px;
    color: var(--text-secondary, #9aa3b2);
    line-height: 1.7;
  }

  .del-option p {
    font-size: 14px;
    color: var(--text-secondary, #9aa3b2);
    line-height: 1.6;
    margin: 0;
  }

  .del-option a {
    color: var(--accent-primary, #FF4D4D);
    text-decoration: none;
  }

  .del-option a:hover {
    text-decoration: underline;
  }
</style>
