<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { userStore, initApp } from '$lib/stores/user.js';
  import Button from '$lib/components/ui/Button.svelte';

  onMount(() => {
    initApp();
  });
</script>

<svelte:head>
  <title>ForkFlirt - Secure Dating for Nerds</title>
</svelte:head>

<div class="hero bg-base-200">
  <div class="hero-content text-center py-8">
    <div class="max-w-4xl">
      <div class="text-center mb-2">
        <div class="avatar">
          <div class="w-20 h-20 mx-auto mb-2 rounded-full overflow-hidden">
            <img src="{base}/forkflirt-logo.png" alt="ForkFlirt Logo" class="w-full h-full object-cover" />
          </div>
        </div>
        <h1 class="text-5xl font-bold text-primary mb-2">ForkFlirt</h1>
        <p class="text-lg text-base-content/70">Secure, decentralized dating for nerds</p>
        <div class="badge badge-primary badge-lg mt-2">GitHub-Powered</div>
              </div>

      <main class="mt-4 grid gap-4 md:grid-cols-2">
      {#if $userStore.loading}
        <div class="col-span-2">
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body items-center text-center">
              <span class="loading loading-spinner loading-lg text-primary"></span>
              <h2 class="card-title">Initializing Secure Session</h2>
              <p>Setting up your encrypted workspace...</p>
            </div>
          </div>
        </div>
      {:else if $userStore.auth}
        <div class="col-span-2">
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <div class="avatar">
                <div class="w-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                  <img src={$userStore.auth.avatar_url} alt={$userStore.auth.login} />
                </div>
              </div>
              <h2 class="card-title justify-center">Welcome back, {$userStore.auth.login}!</h2>
              {#if $userStore.hasEncryptedKeys}
                <div class="alert alert-success">
                  <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>Your identity is secured with passphrase protection</span>
                </div>
              {:else if $userStore.hasKeys}
                <div class="alert alert-warning">
                  <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  <span>You have keys but they're not passphrase-protected</span>
                </div>
              {:else}
                <div class="alert alert-info">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <span>Let's set up your secure identity</span>
                </div>
              {/if}
              <div class="card-actions justify-center mt-4">
                <Button href="{base}/wizard" variant="primary" size="lg">
                  {#if $userStore.hasKeys}Manage Profile{:else}Create Profile{/if}
                </Button>
              </div>
            </div>
          </div>
        </div>
      {:else}
        <div class="card bg-base-100 shadow-xl">
          <figure class="px-10 pt-10">
            <div class="text-6xl">🔐</div>
          </figure>
          <div class="card-body items-center text-center">
            <h2 class="card-title">Secure Login</h2>
            <p class="text-sm text-base-content/70">
              Your GitHub Personal Access Token is encrypted locally and never sent to our servers.
              <br class="hidden sm:block" />
              <span class="text-xs">(because there are none 😂)</span>
            </p>
            <div class="card-actions">
              <Button href="{base}/login" variant="primary" size="lg">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Login with GitHub
              </Button>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-xl">
          <figure class="px-10 pt-10">
            <div class="text-6xl">🛡️</div>
          </figure>
          <div class="card-body">
            <h2 class="card-title">Security Features</h2>
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <div class="badge badge-success badge-sm">✓</div>
                <span class="text-sm">End-to-end encrypted messaging</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="badge badge-success badge-sm">✓</div>
                <span class="text-sm">Passphrase-protected private keys</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="badge badge-success badge-sm">✓</div>
                <span class="text-sm">Replay attack protection</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="badge badge-success badge-sm">✓</div>
                <span class="text-sm">CSRF protection</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="badge badge-success badge-sm">✓</div>
                <span class="text-sm">Rate limiting</span>
              </div>
            </div>
            <div class="card-actions justify-end">
                          </div>
          </div>
        </div>
      {/if}
    </main>
    </div>

    {#if $userStore.error}
      <div class="toast toast-top toast-end">
        <div class="alert alert-error">
          <span>❌ {$userStore.error}</span>
        </div>
      </div>
    {/if}
  </div>
</div>