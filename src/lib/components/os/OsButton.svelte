<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let variant: 'primary' | 'secondary' = 'secondary';
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let disabled = false;
  export let className = '';

  const dispatch = createEventDispatcher<{ click: MouseEvent }>();
</script>

<button
  {type}
  {disabled}
  class={`os-btn ${variant === 'primary' ? 'os-btn--primary' : 'os-btn--secondary'} ${className}`.trim()}
  on:click={(event) => dispatch('click', event)}
>
  <slot />
</button>
