<script lang="ts">
  export let variant: 'identity' | 'recommendation' | 'chat' | 'calendar' | 'instagram' | 'match-score';
</script>

<div class="preview-card">
  {#if variant === 'identity'}
    <div class="preview-label">Identity Graph</div>
    <div class="preview-body">
      <div class="preview-avatar">M</div>
      <div class="preview-name">Madhvik Nemani</div>
      <div class="preview-city">Mumbai</div>
      <div class="preview-tags">
        <span class="ptag ptag--red">Music</span>
        <span class="ptag ptag--blue">Nightlife</span>
        <span class="ptag ptag--gold">Food</span>
        <span class="ptag ptag--red">Travel</span>
        <span class="ptag ptag--blue">Fitness</span>
      </div>
      <div class="preview-domains">
        <div class="preview-domain">
          <span class="pd-label">Music taste</span>
          <div class="pd-bar"><div class="pd-fill pd-fill--red" style="width:92%"></div></div>
        </div>
        <div class="preview-domain">
          <span class="pd-label">Social life</span>
          <div class="pd-bar"><div class="pd-fill pd-fill--blue" style="width:78%"></div></div>
        </div>
        <div class="preview-domain">
          <span class="pd-label">Food & dining</span>
          <div class="pd-bar"><div class="pd-fill pd-fill--gold" style="width:85%"></div></div>
        </div>
      </div>
      <div class="preview-aesthetic">"Warm minimalist with a love for late-night jazz bars"</div>
    </div>

  {:else if variant === 'recommendation'}
    <div class="preview-label">Personalized Picks</div>
    <div class="preview-body">
      <div class="preview-rec-card">
        <div class="prec-header">
          <span class="prec-cat">Restaurant</span>
          <span class="prec-match">92% match</span>
        </div>
        <div class="prec-title">Bombay Canteen</div>
        <div class="prec-desc">Modern Indian, craft cocktails, live music Fridays</div>
        <div class="prec-sources">
          <span class="prec-src">Instagram</span>
          <span class="prec-src">Spotify</span>
        </div>
      </div>
      <div class="preview-rec-card preview-rec-card--dim">
        <div class="prec-header">
          <span class="prec-cat">Event</span>
          <span class="prec-match">87% match</span>
        </div>
        <div class="prec-title">Magnetic Fields Festival</div>
        <div class="prec-desc">Electronic music, art installations, Rajasthan</div>
      </div>
    </div>

  {:else if variant === 'chat'}
    <div class="preview-label">AI Assistant</div>
    <div class="preview-body preview-body--chat">
      <div class="pchat-user">What should I do this weekend?</div>
      <div class="pchat-ai">Based on your taste, here are my picks:</div>
      <div class="pchat-cards">
        <div class="pchat-card">
          <span class="pchat-emoji">&#127869;</span>
          <span>Bastian — seafood + cocktails</span>
        </div>
        <div class="pchat-card">
          <span class="pchat-emoji">&#127926;</span>
          <span>Jazz at Blue Tokai, 8pm</span>
        </div>
        <div class="pchat-card">
          <span class="pchat-emoji">&#127911;</span>
          <span>Your Discover Weekly is fire</span>
        </div>
      </div>
    </div>

  {:else if variant === 'calendar'}
    <div class="preview-label">Schedule Insights</div>
    <div class="preview-body">
      <div class="pcal-item">
        <div class="pcal-time">10:00</div>
        <div class="pcal-event pcal-event--blue">Team standup</div>
      </div>
      <div class="pcal-item">
        <div class="pcal-time">14:00</div>
        <div class="pcal-event pcal-event--gold">Lunch with Rohan @ Bastian</div>
      </div>
      <div class="pcal-item">
        <div class="pcal-time">19:30</div>
        <div class="pcal-event pcal-event--red">Jazz night (suggested)</div>
      </div>
    </div>

  {:else if variant === 'instagram'}
    <div class="preview-label">Extracted Signals</div>
    <div class="preview-body">
      <div class="pig-row">
        <span class="pig-label">Aesthetic</span>
        <span class="pig-value">"warm minimalist"</span>
      </div>
      <div class="pig-row">
        <span class="pig-label">Interests</span>
        <div class="preview-tags" style="margin-top:4px;">
          <span class="ptag ptag--red">Music</span>
          <span class="ptag ptag--gold">Food</span>
          <span class="ptag ptag--blue">Travel</span>
        </div>
      </div>
      <div class="pig-row">
        <span class="pig-label">Vibe</span>
        <span class="pig-value">Late-night, cultural, creative</span>
      </div>
    </div>

  {:else if variant === 'match-score'}
    <div class="preview-label">Signal Strength</div>
    <div class="preview-body preview-body--scores">
      <div class="pscore">
        <div class="pscore-ring pscore-ring--low">72%</div>
        <div class="pscore-label">Phone only</div>
      </div>
      <div class="pscore-arrow">&#8594;</div>
      <div class="pscore">
        <div class="pscore-ring pscore-ring--mid">89%</div>
        <div class="pscore-label">+ Google</div>
      </div>
      <div class="pscore-arrow">&#8594;</div>
      <div class="pscore">
        <div class="pscore-ring pscore-ring--high">95%</div>
        <div class="pscore-label">+ Instagram</div>
      </div>
    </div>
  {/if}
</div>

<style>
  .preview-card {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    padding: 16px;
    backdrop-filter: blur(var(--blur-medium));
    overflow: hidden;
  }

  .preview-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .preview-body { display: flex; flex-direction: column; gap: 8px; }
  .preview-body--chat { gap: 10px; }
  .preview-body--scores { flex-direction: row; align-items: center; justify-content: center; gap: 12px; }

  .preview-avatar {
    width: 40px; height: 40px; border-radius: 50%;
    background: linear-gradient(135deg, #FF4D4D, #FFB84D);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 800; color: white;
    margin-bottom: 4px;
  }
  .preview-name { font-size: 15px; font-weight: 700; color: var(--text-primary); }
  .preview-city { font-size: 12px; color: var(--text-muted); margin-top: -4px; }
  .preview-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
  .ptag {
    font-size: 10px; padding: 3px 8px; border-radius: 100px; font-weight: 600;
  }
  .ptag--red { background: rgba(255,77,77,0.12); color: #FF6B6B; border: 1px solid rgba(255,77,77,0.25); }
  .ptag--blue { background: rgba(77,124,255,0.12); color: #6B9AFF; border: 1px solid rgba(77,124,255,0.25); }
  .ptag--gold { background: rgba(255,184,77,0.12); color: #FFC46B; border: 1px solid rgba(255,184,77,0.25); }

  .preview-domains { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
  .preview-domain { display: flex; align-items: center; gap: 8px; }
  .pd-label { font-size: 11px; color: var(--text-muted); width: 80px; flex-shrink: 0; }
  .pd-bar { flex: 1; height: 4px; border-radius: 2px; background: var(--glass-medium); }
  .pd-fill { height: 100%; border-radius: 2px; }
  .pd-fill--red { background: #FF4D4D; }
  .pd-fill--blue { background: #4D7CFF; }
  .pd-fill--gold { background: #FFB84D; }

  .preview-aesthetic {
    font-size: 11px; color: var(--text-secondary); font-style: italic; margin-top: 4px;
  }

  .preview-rec-card {
    background: var(--glass-medium); border-radius: 12px; padding: 12px;
    border: 1px solid var(--border-subtle);
  }
  .preview-rec-card--dim { opacity: 0.6; }
  .prec-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .prec-cat {
    font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--accent-secondary);
  }
  .prec-match {
    font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 100px;
    background: rgba(255,77,77,0.12); color: #FF6B6B; border: 1px solid rgba(255,77,77,0.25);
  }
  .prec-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
  .prec-desc { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
  .prec-sources { display: flex; gap: 6px; margin-top: 8px; }
  .prec-src {
    font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 100px;
    background: var(--glass-light); color: var(--text-muted); border: 1px solid var(--border-subtle);
  }

  .pchat-user {
    align-self: flex-end; background: var(--glass-medium); border-radius: 14px 14px 4px 14px;
    padding: 10px 14px; font-size: 13px; color: var(--text-primary); max-width: 80%;
    border: 1px solid var(--border-subtle);
  }
  .pchat-ai { font-size: 13px; color: var(--text-secondary); }
  .pchat-cards { display: flex; flex-direction: column; gap: 6px; }
  .pchat-card {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    background: var(--glass-medium); border-radius: 10px;
    font-size: 12px; color: var(--text-primary);
    border: 1px solid var(--border-subtle);
  }
  .pchat-emoji { font-size: 16px; }

  .pcal-item { display: flex; align-items: center; gap: 10px; }
  .pcal-time { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); width: 36px; }
  .pcal-event {
    flex: 1; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 500;
  }
  .pcal-event--blue { background: rgba(77,124,255,0.12); color: #6B9AFF; border-left: 3px solid #4D7CFF; }
  .pcal-event--gold { background: rgba(255,184,77,0.12); color: #FFC46B; border-left: 3px solid #FFB84D; }
  .pcal-event--red { background: rgba(255,77,77,0.12); color: #FF6B6B; border-left: 3px solid #FF4D4D; }

  .pig-row { display: flex; flex-direction: column; gap: 2px; }
  .pig-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .pig-value { font-size: 13px; color: var(--text-secondary); font-style: italic; }

  .pscore { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .pscore-ring {
    width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 800; font-family: var(--font-mono);
  }
  .pscore-ring--low { background: rgba(255,77,77,0.12); color: #FF6B6B; border: 2px solid rgba(255,77,77,0.35); }
  .pscore-ring--mid { background: rgba(255,184,77,0.12); color: #FFC46B; border: 2px solid rgba(255,184,77,0.35); }
  .pscore-ring--high { background: rgba(77,124,255,0.12); color: #6B9AFF; border: 2px solid rgba(77,124,255,0.35); }
  .pscore-label { font-size: 10px; color: var(--text-muted); }
  .pscore-arrow { font-size: 16px; color: var(--text-muted); }
</style>
