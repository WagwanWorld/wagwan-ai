<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let musicVisible = true;
  export let instagramVisible = true;
  export let careerVisible = true;
  export let lifestyleVisible = true;
  export let calendarVisible = false;
  export let emailVisible = false;

  const dispatch = createEventDispatcher();

  function save() {
    dispatch('save', {
      music_visible: musicVisible,
      instagram_visible: instagramVisible,
      career_visible: careerVisible,
      lifestyle_visible: lifestyleVisible,
      calendar_visible: calendarVisible,
      email_visible: emailVisible,
    });
  }

  const sections = [
    { emoji: '🎵', label: 'Music Taste', desc: 'Your listening patterns and genres' },
    { emoji: '📱', label: 'Instagram', desc: 'Your posts, aesthetic, and engagement' },
    { emoji: '💼', label: 'Career', desc: 'Your professional signals and role' },
    { emoji: '🌍', label: 'Lifestyle', desc: 'Your interests, activities, and preferences' },
    { emoji: '📅', label: 'Calendar', desc: 'Your schedule patterns' },
    { emoji: '📧', label: 'Email', desc: 'Your communication patterns' },
  ];
</script>

<div class="vis-card">
  <h3 class="vis-title">Portrait Visibility</h3>
  <p class="vis-desc">Control what brands can see about you</p>

  <div class="vis-rows">
    <label class="vis-row">
      <span class="vis-emoji">{sections[0].emoji}</span>
      <div class="vis-info"><span class="vis-label">{sections[0].label}</span><span class="vis-hint">{sections[0].desc}</span></div>
      <input type="checkbox" class="vis-toggle" bind:checked={musicVisible} on:change={save} />
    </label>
    <label class="vis-row">
      <span class="vis-emoji">{sections[1].emoji}</span>
      <div class="vis-info"><span class="vis-label">{sections[1].label}</span><span class="vis-hint">{sections[1].desc}</span></div>
      <input type="checkbox" class="vis-toggle" bind:checked={instagramVisible} on:change={save} />
    </label>
    <label class="vis-row">
      <span class="vis-emoji">{sections[2].emoji}</span>
      <div class="vis-info"><span class="vis-label">{sections[2].label}</span><span class="vis-hint">{sections[2].desc}</span></div>
      <input type="checkbox" class="vis-toggle" bind:checked={careerVisible} on:change={save} />
    </label>
    <label class="vis-row">
      <span class="vis-emoji">{sections[3].emoji}</span>
      <div class="vis-info"><span class="vis-label">{sections[3].label}</span><span class="vis-hint">{sections[3].desc}</span></div>
      <input type="checkbox" class="vis-toggle" bind:checked={lifestyleVisible} on:change={save} />
    </label>
    <label class="vis-row">
      <span class="vis-emoji">{sections[4].emoji}</span>
      <div class="vis-info"><span class="vis-label">{sections[4].label}</span><span class="vis-hint">{sections[4].desc}</span></div>
      <input type="checkbox" class="vis-toggle" bind:checked={calendarVisible} on:change={save} />
    </label>
    <label class="vis-row">
      <span class="vis-emoji">{sections[5].emoji}</span>
      <div class="vis-info"><span class="vis-label">{sections[5].label}</span><span class="vis-hint">{sections[5].desc}</span></div>
      <input type="checkbox" class="vis-toggle" bind:checked={emailVisible} on:change={save} />
    </label>
  </div>
</div>

<style>
  .vis-card {
    background: var(--glass-light); border: 1px solid var(--border-subtle);
    border-radius: 16px; padding: 20px;
    backdrop-filter: blur(var(--blur-medium)); -webkit-backdrop-filter: blur(var(--blur-medium));
  }
  .vis-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
  .vis-desc { font-size: 12px; color: var(--text-muted); margin: 0 0 16px; }
  .vis-rows { display: flex; flex-direction: column; gap: 12px; }
  .vis-row {
    display: flex; align-items: center; gap: 12px; cursor: pointer;
    padding: 10px 12px; border-radius: 12px; transition: background 0.15s;
  }
  .vis-row:hover { background: var(--glass-medium); }
  .vis-emoji { font-size: 18px; flex-shrink: 0; }
  .vis-info { flex: 1; min-width: 0; }
  .vis-label { display: block; font-size: 13px; font-weight: 600; color: var(--text-primary); }
  .vis-hint { display: block; font-size: 11px; color: var(--text-muted); margin-top: 2px; }
  .vis-toggle { accent-color: #4D7CFF; width: 18px; height: 18px; flex-shrink: 0; cursor: pointer; }
</style>
