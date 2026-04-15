<div class="legal-page">
  <div class="legal-card">
    <h1>Privacy Policy</h1>
    <p class="legal-updated">Last updated: April 15, 2026</p>

    <section>
      <h2>What we collect</h2>
      <p>When you use Wagwan, we collect information you provide directly and data from social accounts you choose to connect:</p>
      <ul>
        <li><strong>Account info</strong> — name, email, profile picture (from Google or Instagram login)</li>
        <li><strong>Instagram data</strong> — public profile, posts, captions, follower count, engagement metrics, comments</li>
        <li><strong>Spotify data</strong> — top artists, genres, listening habits</li>
        <li><strong>Google data</strong> — YouTube subscriptions, liked videos</li>
        <li><strong>LinkedIn data</strong> — name, headline, industry</li>
        <li><strong>Information you provide</strong> — city, interests, budget preferences</li>
      </ul>
    </section>

    <section>
      <h2>How we use it</h2>
      <ul>
        <li>Build your identity graph — a cross-platform profile that helps brands understand who your audience is</li>
        <li>Match you with relevant brand campaigns</li>
        <li>Generate creator scores (engagement, momentum, content themes)</li>
        <li>Improve our matching algorithms</li>
      </ul>
      <p>We <strong>never</strong> sell your personal data to third parties.</p>
    </section>

    <section>
      <h2>What brands see</h2>
      <p>When a brand searches for creators, they may see:</p>
      <ul>
        <li>Your name and handle</li>
        <li>Follower count and engagement tier</li>
        <li>Content themes and match score</li>
        <li>City and archetype</li>
      </ul>
      <p>Brands do <strong>not</strong> see your email, tokens, raw social data, or full identity graph.</p>
    </section>

    <section>
      <h2>Data storage</h2>
      <p>Your data is stored securely on Supabase (PostgreSQL) with row-level security. OAuth tokens are encrypted. We use HTTPS for all data transmission.</p>
    </section>

    <section>
      <h2>Third-party services</h2>
      <ul>
        <li><strong>Anthropic (Claude)</strong> — AI inference for identity analysis and brand matching</li>
        <li><strong>Supabase</strong> — database and authentication</li>
        <li><strong>Vercel</strong> — hosting</li>
        <li><strong>Meta, Google, Spotify, LinkedIn APIs</strong> — social data with your explicit consent</li>
      </ul>
    </section>

    <section>
      <h2>Your rights</h2>
      <ul>
        <li><strong>Access</strong> — view your profile and identity graph anytime</li>
        <li><strong>Delete</strong> — request full data deletion at <a href="/data-deletion">/data-deletion</a></li>
        <li><strong>Disconnect</strong> — remove any connected social account from your profile settings</li>
        <li><strong>Opt out</strong> — hide your profile from brand searches via visibility settings</li>
      </ul>
    </section>

    <section>
      <h2>Cookies</h2>
      <p>We use essential cookies for authentication sessions. No tracking or advertising cookies.</p>
    </section>

    <section>
      <h2>Contact</h2>
      <p>Questions about your data? Email <a href="mailto:madhviknem@gmail.com">madhviknem@gmail.com</a></p>
    </section>
  </div>
</div>

<style>
  .legal-page {
    min-height: 100vh;
    padding: 48px 24px 96px;
    background: var(--bg-primary, #0a0a0f);
    color: var(--text-primary, #e8ecf3);
  }

  .legal-card {
    max-width: 640px;
    margin: 0 auto;
  }

  h1 {
    font-size: 32px;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 0 0 4px;
  }

  .legal-updated {
    font-size: 13px;
    color: var(--text-muted, #6d7684);
    margin: 0 0 40px;
  }

  section {
    margin-bottom: 32px;
  }

  h2 {
    font-size: 17px;
    font-weight: 600;
    margin: 0 0 10px;
  }

  p {
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-secondary, #9aa3b2);
    margin: 0 0 8px;
  }

  ul {
    margin: 0;
    padding-left: 20px;
    font-size: 14px;
    color: var(--text-secondary, #9aa3b2);
    line-height: 1.8;
  }

  li {
    margin-bottom: 4px;
  }

  a {
    color: var(--accent-primary, #FF4D4D);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  strong {
    color: var(--text-primary, #e8ecf3);
    font-weight: 600;
  }
</style>
