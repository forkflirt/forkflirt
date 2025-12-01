<script lang="ts">
  import { onMount } from 'svelte';
  import { userStore, initApp } from '$lib/stores/user.js';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';

  onMount(() => {
    initApp();
  });
</script>

<svelte:head>
  <title>ForkFlirt - Secure Dating for Nerds</title>
</svelte:head>

<div class="min-h-screen bg-base-200 p-4">
  <div class="max-w-4xl mx-auto">
    <header class="text-center mb-8">
      <h1 class="text-4xl font-bold text-primary mb-2">ForkFlirt</h1>
      <p class="text-lg text-base-content/70">Secure, decentralized dating for developers</p>
    </header>

    <main class="grid gap-6 md:grid-cols-2">
      {#if $userStore.loading}
        <Card className="col-span-2">
          <div class="text-center p-8">
            <span class="loading loading-spinner loading-lg"></span>
            <p class="mt-4">Loading...</p>
          </div>
        </Card>
      {:else if $userStore.auth}
        <Card className="col-span-2">
          <div class="text-center p-8">
            <h2 class="text-2xl font-semibold mb-4">Welcome back, {$userStore.auth.login}!</h2>
            {#if $userStore.hasEncryptedKeys}
              <p class="text-success mb-4">✅ Your identity is secured with passphrase protection</p>
            {:else if $userStore.hasKeys}
              <p class="text-warning mb-4">⚠️ You have keys but they're not passphrase-protected</p>
            {:else}
              <p class="text-info mb-4">🔐 Let's set up your secure identity</p>
            {/if}
            <Button href="/wizard" variant="primary" size="lg" wide>
              {#if $userStore.hasKeys}Manage Profile{:else}Create Profile{/if}
            </Button>
          </div>
        </Card>
      {:else}
        <Card>
          <h2 class="text-xl font-semibold mb-4">🔐 Secure Login</h2>
          <p class="text-sm text-base-content/70 mb-4">
            Your GitHub Personal Access Token is encrypted locally and never sent to our servers.
          </p>
          <Button href="/login" variant="primary" size="lg" wide>
            Login with GitHub
          </Button>
        </Card>

        <Card>
          <h2 class="text-xl font-semibold mb-4">🛡️ Security Features</h2>
          <ul class="space-y-2 text-sm">
            <li>✅ End-to-end encrypted messaging</li>
            <li>✅ Passphrase-protected private keys</li>
            <li>✅ Replay attack protection</li>
            <li>✅ CSRF protection</li>
            <li>✅ Rate limiting</li>
          </ul>
        </Card>
      {/if}
    </main>

    {#if $userStore.error}
      <div class="toast toast-top toast-end">
        <div class="alert alert-error">
          <span>❌ {$userStore.error}</span>
        </div>
      </div>
    {/if}
  </div>
</div>