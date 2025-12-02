<script lang="ts">
  import '../app.css';
  import { userStore, logout } from '$lib/stores/user.js';
  import { theme } from '$lib/stores/theme.js';
  import Button from '$lib/components/ui/Button.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { triggerPanicMode } from '$lib/api/panic.js';
  import { browser } from '$app/environment';

  let showPanicConfirm = false;

  // Initialize theme on app load
  if (browser) {
    const savedTheme = localStorage.getItem('theme') || 'valentine';
    theme.set(savedTheme);
  }

  async function handlePanicMode() {
    try {
      await triggerPanicMode();
    } catch (error) {
      console.error('Panic mode failed:', error);
      // Force redirect even if panic mode fails
      window.location.replace('https://www.wikipedia.org');
    }
  }

  async function handleLogout() {
    try {
      await logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }
</script>

<svelte:head>
  <title>ForkFlirt - Secure Dating for Nerds</title>
  <meta http-equiv="content-security-policy" content="
    default-src 'none';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https://raw.githubusercontent.com https://placehold.co;
    connect-src 'self' https://api.github.com https://raw.githubusercontent.com https://keybase.io https://dns.google;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    upgrade-insecure-requests;
    block-all-mixed-content;
  ">
</svelte:head>

<div class="min-h-screen bg-base-200 flex flex-col">
  <nav class="navbar bg-base-100 shadow-lg flex-shrink-0">
    <div class="navbar-start">
      <div class="flex items-center gap-2">
        <span class="text-2xl">💞</span>
      </div>
    </div>

    <div class="navbar-center">
      <span class="text-xl font-bold text-primary">ForkFlirt</span>
    </div>

    <div class="navbar-end">
      <div class="flex items-center gap-2">
        {#if $userStore.auth}
          <ThemeToggle />
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
          <!-- Settings dropdown -->
          <div class="dropdown dropdown-end">
            <Button
              tabindex="0"
              role="button"
              variant="ghost"
              size="sm"
              class="btn-circle"
            >
              ⚙️
            </Button>
            <ul
              class="dropdown-content menu p-1 shadow bg-base-100 rounded-box w-40"
            >
              <li>
                <button class="text-warning hover:bg-warning/10 w-full text-left" on:click={handleLogout}>
                  🚪 Logout
                </button>
              </li>
            </ul>
          </div>
        {:else}
          <ThemeToggle />
          <Button href="/login" variant="primary" size="sm">
            Login
          </Button>
        {/if}
      </div>
    </div>
  </nav>

  <main class="flex-1 max-w-4xl mx-auto p-6">
    <slot />
  </main>

  <footer class="footer footer-center p-4 bg-base-300 text-base-content flex-shrink-0">
    <div class="text-sm">
      <p>🛡️ Encrypted dating for nerds</p>
      <p class="text-xs opacity-70 mt-1">
        Private keys protected with passphrases • Messages secured with replay protection
      </p>
    </div>
  </footer>
</div>

<!-- Emergency Exit Button - Fixed Bottom Right -->
{#if $userStore.auth}
  <button
    class="fixed bottom-4 right-4 btn btn-error btn-outline btn-sm opacity-50 hover:opacity-100 transition-opacity"
    on:click={() => showPanicConfirm = true}
    title="Emergency Exit - Delete all data"
  >
    🚨
  </button>
{/if}

{#if $userStore.error}
  <div class="toast toast-top toast-end">
    <div class="alert alert-error">
      <span>❌ {$userStore.error}</span>
    </div>
  </div>
{/if}

<!-- Panic Confirmation Modal -->
{#if showPanicConfirm}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg text-error">🚨 Emergency Data Deletion</h3>
      <p class="py-4">
        This will <strong>permanently delete all your ForkFlirt data</strong> including:
      </p>
      <ul class="list-disc pl-6 space-y-1 mb-4">
        <li>Cryptographic keys (cannot be recovered)</li>
        <li>All encrypted messages</li>
        <li>Profile data and settings</li>
        <li>All browser storage for this site</li>
      </ul>
      <p class="text-sm text-base-content/70 mb-4">
        You will be redirected to a neutral website. This action <strong>cannot be undone</strong>.
      </p>
      <div class="modal-action">
        <button
          class="btn btn-ghost"
          on:click={() => showPanicConfirm = false}
        >
          Cancel
        </button>
        <button
          class="btn btn-error"
          on:click={handlePanicMode}
        >
          Delete All Data
        </button>
      </div>
    </div>
  </div>
{/if}