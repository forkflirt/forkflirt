<script lang="ts">
  import { generateCaptcha, storeCaptchaChallenge, verifyCaptcha, clearCaptcha, getCaptchaAttemptData } from '$lib/api/auth';
  import { createEventDispatcher } from 'svelte';

  export let onSuccess: () => void;
  export let onCancel: () => void;

  let captcha: { question: string; answer: number; timestamp: number };
  let userAnswer = '';
  let error = '';
  let loading = false;
  let rateLimited = false;

  const dispatch = createEventDispatcher();

  function generateNewCaptcha() {
    captcha = generateCaptcha();
    storeCaptchaChallenge(captcha);
    userAnswer = '';
    error = '';
    checkRateLimit();
  }

  function checkRateLimit() {
    const attemptData = getCaptchaAttemptData();
    const MAX_ATTEMPTS = 3;
    const WINDOW = 5 * 60 * 1000; // 5 minutes

    if (attemptData.attempts >= MAX_ATTEMPTS &&
        Date.now() - attemptData.windowStart < WINDOW) {
      rateLimited = true;
      const remainingMinutes = Math.ceil((WINDOW - (Date.now() - attemptData.windowStart)) / 60000);
      error = `Too many failed attempts. Please try again in ${remainingMinutes} minutes.`;
    } else {
      rateLimited = false;
    }
  }

  function handleSubmit() {
    if (!userAnswer.trim()) {
      error = 'Please enter an answer';
      return;
    }

    if (rateLimited) {
      checkRateLimit();
      return;
    }

    loading = true;

    if (verifyCaptcha(userAnswer.trim())) {
      dispatch('success', { answer: userAnswer.trim() });
      onSuccess();
    } else {
      error = 'Incorrect answer. Please try again.';
      checkRateLimit(); // Update rate limit status
      if (!rateLimited) {
        generateNewCaptcha();
      }
    }

    loading = false;
  }

  function handleCancel() {
    clearCaptcha();
    onCancel();
  }

  // Generate initial captcha
  generateNewCaptcha();
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div class="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
    <div class="text-center">
      <h2 class="text-xl font-semibold text-gray-900 mb-2">Security Check</h2>
      <p class="text-sm text-gray-600 mb-4">
        Please complete this security challenge to continue
      </p>

      <div class="bg-gray-50 rounded-lg p-4 mb-4">
        <p class="text-lg font-mono text-center text-gray-800">
          {captcha.question}
        </p>
      </div>

      <form on:submit|preventDefault={handleSubmit}>
        <input
          type="text"
          bind:value={userAnswer}
          placeholder="Enter your answer"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />

        {#if error}
          <p class="text-red-500 text-sm mt-2">{error}</p>
        {/if}

        <div class="flex gap-2 mt-4">
          <button
            type="button"
            on:click={generateNewCaptcha}
            class="flex-1 px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            disabled={loading || rateLimited}
          >
            🔄 New Challenge
          </button>

          <button
            type="submit"
            class="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={loading || rateLimited}
          >
            {loading ? 'Verifying...' : 'Submit'}
          </button>
        </div>

        <button
          type="button"
          on:click={handleCancel}
          class="w-full mt-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none"
        >
          Cancel
        </button>
      </form>
    </div>
  </div>
</div>