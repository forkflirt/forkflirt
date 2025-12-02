<script lang="ts">
  import { base } from '$app/paths';
  import { profileUpdated } from '$lib/stores/user.js';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';

  let step = 1;
  let passphrase = '';
  let passphraseConfirm = '';
  let loading = false;
  let error = '';



  async function generateKeys() {
    if (passphrase !== passphraseConfirm) {
      error = 'Passphrases do not match';
      return;
    }

    loading = true;
    error = '';

    try {
      const { generateIdentityWithPassphrase } = await import('$lib/crypto/keys.js');
      await generateIdentityWithPassphrase(passphrase);

      // CRITICAL: Clear passphrases from memory immediately after use
      passphrase = '';
      passphraseConfirm = '';

      // Force garbage collection hint
      if (window.gc) {
        window.gc();
      }

      // Update store to reflect new keys
      profileUpdated({
        identity: {
          display_name: '',
          age: 25,
          location: {
            city: '',
            country_code: ''
          }
        },
        content: {},
        security: {
          public_key: ''
        }
      });

      step = 3; // Success
    } catch (err: any) {
      error = err.message || 'Key generation failed';

      // CRITICAL: Clear passphrases even on error
      passphrase = '';
      passphraseConfirm = '';

      // Force garbage collection hint
      if (window.gc) {
        window.gc();
      }
    } finally {
      loading = false;
    }
  }

  function validatePassphrase(p: string): { valid: boolean; reason?: string } {
    const words = p.trim().split(/[\s\-\.]+/);
    const hasLetters = /[a-zA-Z]/.test(p);
    const hasNumbers = /\d/.test(p);
    const hasSymbols = /[^\w]/.test(p);

    if (words.length < 4) return { valid: false, reason: "Must be at least 4 words" };
    if (p.length < 12) return { valid: false, reason: "Must be at least 12 characters" };

    const complexityCount = [hasLetters, hasNumbers, hasSymbols].filter(Boolean).length;
    if (complexityCount < 2) return { valid: false, reason: "Must include at least 2 of: letters, numbers, symbols" };

    return { valid: true };
  }

  $: validation = validatePassphrase(passphrase);
  $: hasLetters = /[a-zA-Z]/.test(passphrase);
  $: hasNumbers = /\d/.test(passphrase);
  $: hasSymbols = /[^\w]/.test(passphrase);
  $: complexityOk = hasLetters && (hasNumbers || hasSymbols);
</script>

<svelte:head>
  <title>Setup Profile - ForkFlirt</title>
</svelte:head>

<div class="min-h-screen bg-base-200 flex items-center justify-center p-4">
  <div class="w-full max-w-lg">
    <Card>
      <div class="text-center mb-6">
        <h1 class="text-3xl font-bold text-primary mb-2">🔐 Create Secure Identity</h1>
        <p class="text-sm text-base-content/70">
          Your private keys will be protected with a strong passphrase
        </p>
      </div>

      {#if step === 1}
        <div class="space-y-6">
          <div>
            <h2 class="text-lg font-semibold mb-3">Passphrase Requirements</h2>
            <ul class="space-y-2 text-sm">
              <li class="flex items-center gap-2">
                <span class={passphrase.split(/[\s\-\.]+/).length >= 4 ? 'text-success' : 'text-base-content/50'}>
                  {passphrase.split(/[\s\-\.]+/).length >= 4 ? '✓' : '○'}
                </span>
                At least 4 words
              </li>
              <li class="flex items-center gap-2">
                <span class={passphrase.length >= 12 ? 'text-success' : 'text-base-content/50'}>
                  {passphrase.length >= 12 ? '✓' : '○'}
                </span>
                At least 12 characters
              </li>
              <li class="flex items-center gap-2">
                <span class={complexityOk ? 'text-success' : 'text-base-content/50'}>
                  {complexityOk ? '✓' : '○'}
                </span>
                Letters + (numbers or symbols)
              </li>
            </ul>
          </div>

          <div class="space-y-4">
            <div>
              <label for="passphrase" class="block text-sm font-medium mb-2">
                Secure Passphrase
              </label>
              <input
                id="passphrase"
                type="password"
                bind:value={passphrase}
                class="input input-bordered w-full font-mono"
                placeholder="correct horse battery staple"
                disabled={loading}
              />
            </div>

            <div>
              <label for="confirm" class="block text-sm font-medium mb-2">
                Confirm Passphrase
              </label>
              <input
                id="confirm"
                type="password"
                bind:value={passphraseConfirm}
                class="input input-bordered w-full font-mono"
                placeholder="Re-enter your passphrase"
                disabled={loading}
              />
            </div>
          </div>

          {#if error}
            <div class="alert alert-error">
              <span>❌ {error}</span>
            </div>
          {/if}

          <Button
            on:click={generateKeys}
            variant="primary"
            size="lg"
            wide
            loading={loading}
            disabled={loading || !validation.valid || !passphraseConfirm}
          >
            {loading ? 'Generating Keys...' : 'Generate Secure Identity'}
          </Button>
        </div>
      {:else if step === 3}
        <div class="text-center space-y-4">
          <div class="text-6xl">🎉</div>
          <h2 class="text-2xl font-bold text-success">Identity Created!</h2>
          <p class="text-base-content/70">
            Your cryptographic identity has been generated and protected with your passphrase.
          </p>
          <div class="alert alert-info">
            <span>💡 Store your passphrase safely - it cannot be recovered!</span>
          </div>
          <Button href="{base}/" variant="primary" size="lg" wide>
            Continue to App
          </Button>
        </div>
      {/if}
    </Card>

    <div class="mt-6 text-center">
      <Button href="{base}/" variant="ghost" size="sm">
        ← Back to Home
      </Button>
    </div>
  </div>
</div>