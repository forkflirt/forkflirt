<script lang="ts">
  import { onMount } from 'svelte';
  import { login } from '$lib/stores/user.js';
  import { generateCSRFToken, getGitHubTokenUrl } from '$lib/api/auth.js';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';

  let token = '';
  let loading = false;
  let error = '';

  onMount(async () => {
    // Generate CSRF token on page load
    await generateCSRFToken();
  });

  async function handleLogin() {
    if (!token.trim()) {
      error = 'Please enter your GitHub Personal Access Token';
      return;
    }

    loading = true;
    error = '';

    try {
      await login(token.trim());
      // Redirect will happen automatically via store update
    } catch (err: any) {
      error = err.message || 'Login failed';
    } finally {
      loading = false;
    }
  }

  function openTokenUrl() {
    window.open(getGitHubTokenUrl(), '_blank');
  }
</script>

<svelte:head>
  <title>Login - ForkFlirt</title>
</svelte:head>

<div class="min-h-screen bg-base-200 flex items-center justify-center p-4">
  <div class="w-full max-w-md">
    <Card>
      <div class="text-center mb-6">
        <h1 class="text-3xl font-bold text-primary mb-2">🔐 Secure Login</h1>
        <p class="text-sm text-base-content/70">
          Enter your GitHub Personal Access Token
        </p>
      </div>

      <form on:submit|preventDefault={handleLogin} class="space-y-4">
        <div>
          <label for="token" class="block text-sm font-medium mb-2">
            GitHub Personal Access Token
          </label>
          <textarea
            id="token"
            bind:value={token}
            class="textarea textarea-bordered w-full h-24 font-mono text-sm"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            required
            disabled={loading}
          ></textarea>
          <div class="text-xs text-base-content/50 mt-1">
            Token is encrypted locally and never sent to our servers
          </div>
        </div>

        {#if error}
          <div class="alert alert-error">
            <span>❌ {error}</span>
          </div>
        {/if}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          wide
          loading={loading}
          disabled={loading || !token.trim()}
        >
          {loading ? 'Securing Session...' : 'Login'}
        </Button>
      </form>

      <div class="mt-6 pt-6 border-t border-base-300">
        <div class="text-center">
          <p class="text-sm text-base-content/70 mb-3">
            Need a GitHub Personal Access Token?
          </p>
          <Button
            variant="secondary"
            size="sm"
            on:click={openTokenUrl}
          >
            Generate Token
          </Button>
        </div>
      </div>

      <div class="mt-6 pt-6 border-t border-base-300">
        <h3 class="text-sm font-semibold mb-3">🛡️ Security Features</h3>
        <ul class="text-xs space-y-1 text-base-content/60">
          <li>• CSRF protection enabled</li>
          <li>• Rate limiting active (3 attempts/10min)</li>
          <li>• URL token injection blocked</li>
          <li>• End-to-end encryption ready</li>
        </ul>
      </div>
    </Card>
  </div>
</div>