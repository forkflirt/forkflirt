<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { KeyRotationManager, DEFAULT_ROTATION_CONFIG, type KeyRotationConfig, type KeyRotationData } from '$lib/crypto/key-rotation';
  import { rotateIdentityWithPassphrase, loadKeyRotationData, saveKeyRotationData, exportPublicKeyToPEM } from '$lib/crypto/keys';
  import { signProfile } from '$lib/crypto/profile-signature';
  import type { Profile } from '$lib/schemas/validator';

  export let isOpen = false;
  export let profile: Profile;
  export let onProfileUpdate: (updatedProfile: Profile) => void;

  const dispatch = createEventDispatcher();

  let currentConfig: KeyRotationConfig = DEFAULT_ROTATION_CONFIG;
  let currentRotationData: KeyRotationData | null = null;
  let passphrase = '';
  let passphraseConfirm = '';
  let isLoading = false;
  let error = '';
  let success = '';

  // UI state
  let activeTab: 'status' | 'rotate' | 'config' = 'status';

  $: rotationStatus = currentRotationData ?
    KeyRotationManager.needsRotation(currentRotationData, currentConfig) : false;

  $: nextRotationDate = currentRotationData?.next_rotation ?
    new Date(currentRotationData.next_rotation).toLocaleDateString() : 'Not scheduled';

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    try {
      currentConfig = await KeyRotationManager.getRotationConfig();
      currentRotationData = await loadKeyRotationData();

      // If no rotation data exists, try to migrate
      if (!currentRotationData) {
        // This would be called during profile setup
        console.log('No rotation data found - will be created during next profile update');
      }
    } catch (err) {
      console.error('Failed to load key rotation data:', err);
    }
  }

  async function handleRotateKey() {
    if (passphrase !== passphraseConfirm) {
      error = 'Passphrases do not match';
      return;
    }

    if (passphrase.length < 4) {
      error = 'Passphrase must be at least 4 words';
      return;
    }

    isLoading = true;
    error = '';
    success = '';

    try {
      // Get current rotation data or initialize it
      const rotationData = currentRotationData ||
        KeyRotationManager.initializeKeyRotation(profile.security.public_key);

      // Perform key rotation
      const { keyPair, rotationData: newRotationData } =
        await rotateIdentityWithPassphrase(passphrase, rotationData);

      // Update profile with new public key and rotation data
      const updatedProfile = {
        ...profile,
        security: {
          ...profile.security,
          public_key: await exportPublicKeyToPEM(keyPair.publicKey),
          key_rotation: newRotationData
        }
      };

      // Sign the updated profile with new private key
      const signedProfile = {
        ...updatedProfile,
        ...await signProfile(updatedProfile, keyPair.privateKey)
      };

      // Save rotation data locally
      await saveKeyRotationData(newRotationData);

      // Update parent component
      onProfileUpdate(signedProfile);

      success = 'Key rotation completed successfully! Your profile has been updated and signed.';
      currentRotationData = newRotationData;

      // Clear form
      passphrase = '';
      passphraseConfirm = '';

      dispatch('rotated', { profile: signedProfile });

    } catch (err) {
      error = err instanceof Error ? err.message : 'Key rotation failed';
      console.error('Key rotation error:', err);
    } finally {
      isLoading = false;
    }
  }

  async function handleConfigSave() {
    try {
      await KeyRotationManager.saveRotationConfig(currentConfig);
      success = 'Configuration saved successfully!';

      // Update next rotation date if auto-rotate is enabled
      if (currentConfig.auto_rotate && currentRotationData) {
        const nextDate = KeyRotationManager.calculateNextRotation(
          currentRotationData.rotation_timestamp,
          currentConfig.rotation_interval_days
        );
        currentRotationData.next_rotation = nextDate.toISOString();
        await saveKeyRotationData(currentRotationData);
      }

      setTimeout(() => success = '', 3000);
    } catch (err) {
      error = 'Failed to save configuration';
      console.error('Config save error:', err);
    }
  }

  function closeModal() {
    isOpen = false;
    error = '';
    success = '';
    activeTab = 'status';
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function daysUntilRotation(): string {
    if (!currentRotationData?.next_rotation) return 'Not scheduled';

    const now = new Date();
    const rotationDate = new Date(currentRotationData.next_rotation);
    const diffTime = rotationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `${diffDays} days`;
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-neutral/50 flex items-center justify-center z-50">
    <div class="bg-base-100 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-semibold text-base-content">Key Security Management</h2>
        <button on:click={closeModal} class="text-base-content/50 hover:text-base-content" aria-label="Close">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Tab Navigation -->
      <div class="border-b border-base-300 mb-6">
        <nav class="flex space-x-8">
          <button
            on:click={() => activeTab = 'status'}
            class="pb-2 px-1 border-b-2 font-medium text-sm {{
              'border-primary text-primary': activeTab === 'status',
              'border-transparent text-base-content/50 hover:text-base-content hover:border-base-300': activeTab !== 'status'
            }}"
          >
            Status
          </button>
          <button
            on:click={() => activeTab = 'rotate'}
            class="pb-2 px-1 border-b-2 font-medium text-sm {{
              'border-primary text-primary': activeTab === 'rotate',
              'border-transparent text-base-content/50 hover:text-base-content hover:border-base-300': activeTab !== 'rotate'
            }}"
          >
            Rotate Key
          </button>
          <button
            on:click={() => activeTab = 'config'}
            class="pb-2 px-1 border-b-2 font-medium text-sm {{
              'border-primary text-primary': activeTab === 'config',
              'border-transparent text-base-content/50 hover:text-base-content hover:border-base-300': activeTab !== 'config'
            }}"
          >
            Configuration
          </button>
        </nav>
      </div>

      <!-- Error/Success Messages -->
      {#if error}
        <div class="mb-4 p-3 bg-error/10 border border-error/30 text-error rounded-md">
          {error}
        </div>
      {/if}

      {#if success}
        <div class="mb-4 p-3 bg-success/10 border border-success/30 text-success rounded-md">
          {success}
        </div>
      {/if}

      <!-- Status Tab -->
      {#if activeTab === 'status'}
        <div class="space-y-6">
          <div class="bg-base-200 p-4 rounded-lg">
            <h3 class="text-lg font-medium text-base-content mb-3">Current Key Status</h3>

            {#if currentRotationData}
              <dl class="grid grid-cols-1 gap-4">
                <div>
                  <dt class="text-sm font-medium text-base-content/70">Key Version</dt>
                  <dd class="mt-1 text-sm text-base-content">#{currentRotationData.rotation_version}</dd>
                </div>

                <div>
                  <dt class="text-sm font-medium text-base-content/70">Current Key Created</dt>
                  <dd class="mt-1 text-sm text-base-content">{formatDate(currentRotationData.rotation_timestamp)}</dd>
                </div>

                <div>
                  <dt class="text-sm font-medium text-base-content/70">Previous Keys</dt>
                  <dd class="mt-1 text-sm text-base-content">{currentRotationData.previous_keys.length} stored</dd>
                </div>

                <div>
                  <dt class="text-sm font-medium text-base-content/70">Next Rotation</dt>
                  <dd class="mt-1 text-sm text-base-content">{nextRotationDate} ({daysUntilRotation()})</dd>
                </div>

                <div>
                  <dt class="text-sm font-medium text-base-content/70">Auto-Rotation</dt>
                  <dd class="mt-1 text-sm text-base-content">
                    <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full {{
                          'bg-success/20 text-success': currentConfig.auto_rotate,
                          'bg-base-300 text-base-content': !currentConfig.auto_rotate
                        }}">
                      {currentConfig.auto_rotate ? 'Enabled' : 'Disabled'}
                    </span>
                  </dd>
                </div>

                <div>
                  <dt class="text-sm font-medium text-base-content/70">Rotation Status</dt>
                  <dd class="mt-1 text-sm text-base-content">
                    <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full {{
                          'bg-warning/20 text-warning': rotationStatus,
                          'bg-success/20 text-success': !rotationStatus
                        }}">
                      {rotationStatus ? 'Rotation Recommended' : 'Up to Date'}
                    </span>
                  </dd>
                </div>
              </dl>
            {:else}
              <p class="text-sm text-base-content/70">
                Key rotation data not found. Your profile will be migrated to the key rotation system
                during the next key rotation.
              </p>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Rotate Key Tab -->
      {#if activeTab === 'rotate'}
        <div class="space-y-6">
          <div class="bg-warning/10 border border-warning/30 p-4 rounded-md">
            <h4 class="text-sm font-medium text-warning mb-2">Important Security Notice</h4>
            <ul class="text-sm text-warning/80 space-y-1">
              <li>• Key rotation creates a new cryptographic identity</li>
              <li>• Your previous key is kept for decryption of old messages</li>
              <li>• Your profile will be automatically re-signed with the new key</li>
              <li>• Store your passphrase securely - you cannot recover lost keys</li>
            </ul>
          </div>

          <form on:submit|preventDefault={handleRotateKey} class="space-y-4">
            <div>
              <label for="passphrase" class="block text-sm font-medium text-base-content mb-1">
                Current Passphrase
              </label>
              <input
                id="passphrase"
                type="password"
                bind:value={passphrase}
                placeholder="Enter your passphrase"
                class="w-full px-3 py-2 border border-base-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label for="passphraseConfirm" class="block text-sm font-medium text-base-content mb-1">
                Confirm Passphrase
              </label>
              <input
                id="passphraseConfirm"
                type="password"
                bind:value={passphraseConfirm}
                placeholder="Confirm your passphrase"
                class="w-full px-3 py-2 border border-base-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !passphrase || !passphraseConfirm}
              class="w-full bg-error text-error-content py-2 px-4 rounded-md hover:bg-error/90 disabled:bg-base-300 disabled:cursor-not-allowed"
            >
              {#if isLoading}
                <span class="inline-flex items-center">
                  <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-error-content" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Rotating Key...
                </span>
              {:else}
                Rotate Identity Key
              {/if}
            </button>
          </form>
        </div>
      {/if}

      <!-- Configuration Tab -->
      {#if activeTab === 'config'}
        <div class="space-y-6">
          <form on:submit|preventDefault={handleConfigSave} class="space-y-4">
            <div>
              <label for="rotationInterval" class="block text-sm font-medium text-base-content mb-1">
                Rotation Interval (days)
              </label>
              <input
                id="rotationInterval"
                type="number"
                bind:value={currentConfig.rotation_interval_days}
                min="30"
                max="730"
                class="w-full px-3 py-2 border border-base-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p class="mt-1 text-sm text-base-content/70">
                How often to automatically rotate keys (30-730 days)
              </p>
            </div>

            <div>
              <label for="transitionPeriod" class="block text-sm font-medium text-base-content mb-1">
                Transition Period (days)
              </label>
              <input
                id="transitionPeriod"
                type="number"
                bind:value={currentConfig.transition_period_days}
                min="7"
                max="180"
                class="w-full px-3 py-2 border border-base-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p class="mt-1 text-sm text-base-content/70">
                How long previous keys remain valid for decryption (7-180 days)
              </p>
            </div>

            <div>
              <label for="maxPreviousKeys" class="block text-sm font-medium text-base-content mb-1">
                Maximum Previous Keys
              </label>
              <input
                id="maxPreviousKeys"
                type="number"
                bind:value={currentConfig.max_previous_keys}
                min="1"
                max="10"
                class="w-full px-3 py-2 border border-base-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p class="mt-1 text-sm text-base-content/70">
                Maximum number of previous keys to keep for decryption (1-10)
              </p>
            </div>

            <div class="flex items-center">
              <input
                id="autoRotate"
                type="checkbox"
                bind:checked={currentConfig.auto_rotate}
                class="h-4 w-4 text-primary focus:ring-primary border-base-300 rounded"
              />
              <label for="autoRotate" class="ml-2 block text-sm text-base-content">
                Enable automatic key rotation
              </label>
            </div>
            <p class="mt-1 text-sm text-base-content/70">
              When enabled, keys will be automatically rotated on the scheduled date
            </p>

            <button
              type="submit"
              class="w-full bg-primary text-primary-content py-2 px-4 rounded-md hover:bg-primary/90"
            >
              Save Configuration
            </button>
          </form>
        </div>
      {/if}
    </div>
  </div>
{/if}