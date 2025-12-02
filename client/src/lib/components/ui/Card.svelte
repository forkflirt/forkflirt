<script lang="ts">
  export let className: string = '';
  
  // Reactive class string
  $: classes = `card ${className || ''}`;
</script>

<div class={classes}>
  <slot />
</div>