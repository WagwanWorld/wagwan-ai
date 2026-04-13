<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { profile, type UserProfile } from '$lib/stores/profile';
  import {
    isAppSessionValid,
    maybeRepairIgOnlyAccountKey,
    invalidateAndGoToOnboarding,
  } from '$lib/auth/sessionGate';

  onMount(() => {
    try {
      const raw = localStorage.getItem('wagwan_profile_v2');
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed?.setupComplete) {
        goto('/onboarding', { replaceState: true });
        return;
      }
      const repaired = maybeRepairIgOnlyAccountKey(parsed as UserProfile);
      if (repaired) {
        profile.set(repaired);
        void fetch('/api/profile/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googleSub: repaired.googleSub,
            profile: repaired,
            tokens: {},
          }),
        }).catch(() => {});
      }
      if (!isAppSessionValid(get(profile))) {
        invalidateAndGoToOnboarding();
        return;
      }
      goto('/profile', { replaceState: true });
    } catch {
      goto('/onboarding', { replaceState: true });
    }
  });
</script>

<!-- Blank splash while redirecting -->
<div style="flex:1; display:flex; align-items:center; justify-content:center;">
  <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#4F46E5);display:flex;align-items:center;justify-content:center;font-size:22px;" class="pulse-glow">
    ✦
  </div>
</div>
