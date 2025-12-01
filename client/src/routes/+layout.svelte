<script lang="ts">
  import { userStore } from '$lib/stores/user.js';
  import Button from '$lib/components/ui/Button.svelte';
</script>

<svelte:head>
  <title>ForkFlirt - Secure Dating for Nerds</title>
  <meta http-equiv="content-security-policy" content="
    default-src 'self';
    script-src 'self' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https://raw.githubusercontent.com https://placehold.co;
    connect-src 'self' https://api.github.com https://raw.githubusercontent.com https://keybase.io https://dns.google;
    font-src 'self';
  ">
</svelte:head>

<div class="min-h-screen bg-base-200">
  <nav class="navbar bg-base-100 shadow-lg">
    <div class="max-w-7xl mx-auto px-4">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center gap-2">
          <span class="text-2xl">🔐</span>
          <span class="text-xl font-bold text-primary">ForkFlirt</span>
        </div>
        
        <div class="flex items-center gap-4">
          {#if $userStore.auth}
            <div class="flex items-center gap-2">
              <img 
                src={$userStore.auth.avatar_url} 
                alt={$userStore.auth.login} 
                class="w-8 h-8 rounded-full"
              />
              <span class="text-sm font-medium">{$userStore.auth.login}</span>
            </div>
            <Button href="/wizard" variant="ghost" size="sm">
              Profile
            </Button>
          {:else}
            <Button href="/login" variant="primary" size="sm">
              Login
            </Button>
          {/if}
        </div>
      </div>
    </div>
  </nav>

  <main class="max-w-4xl mx-auto p-6">
    <slot />
  </main>

  <footer class="footer footer-center p-4 bg-base-300 text-base-content">
    <div class="text-sm">
      <p>🛡️ End-to-end encrypted dating for developers</p>
      <p class="text-xs opacity-70 mt-1">
        Private keys protected with passphrases • Messages secured with replay protection
      </p>
    </div>
  </footer>
</div>

{#if $userStore.error}
  <div class="toast toast-top toast-end">
    <div class="alert alert-error">
      <span>❌ {$userStore.error}</span>
    </div>
  </div>
{/if}