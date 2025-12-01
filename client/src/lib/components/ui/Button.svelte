<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let variant:
    | "primary"
    | "secondary"
    | "accent"
    | "neutral"
    | "ghost"
    | "link"
    | "error"
    | "success"
    | "warning" = "primary";
  export let size: "xs" | "sm" | "md" | "lg" = "md";
  export let outline = false;
  export let wide = false;
  export let loading = false;
  export let disabled = false;
  export let href: string | undefined = undefined;
  export let type: "button" | "submit" | "reset" = "button";

  const dispatch = createEventDispatcher();

  function handleClick(event: MouseEvent) {
    if (!disabled && !loading) {
      dispatch("click", event);
    }
  }

  // Reactive class string
  $: classes = `
    btn 
    btn-${variant} 
    btn-${size} 
    ${outline ? "btn-outline" : ""} 
    ${wide ? "btn-wide" : ""} 
    ${$$props.class || ""}
  `;
</script>

{#if href}
  <a
    {href}
    class={classes}
    role="button"
    aria-disabled={disabled}
    tabindex={disabled ? -1 : 0}
  >
    <slot />
  </a>
{:else}
  <button
    {type}
    class={classes}
    disabled={disabled || loading}
    on:click={handleClick}
    {...$$restProps}
  >
    {#if loading}
      <span class="loading loading-spinner loading-xs"></span>
    {/if}
    <slot />
  </button>
{/if}
