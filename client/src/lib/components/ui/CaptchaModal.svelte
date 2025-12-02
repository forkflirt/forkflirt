<script lang="ts">
  import { storeCaptchaChallenge, clearCaptcha, getCaptchaAttemptData } from '$lib/api/auth';
  import { createEventDispatcher } from 'svelte';

  export let onSuccess: (answer: string) => void;
  export let onCancel: () => void;

  let captchaDataUrl: string = '';
  let captchaAnswer: string = '';
  let userAnswer = '';
  let error = '';
  let loading = false;
  let rateLimited = false;

  const dispatch = createEventDispatcher();

  function generateVisualCaptcha(): { dataUrl: string; answer: string } {
    const canvasElement = document.createElement('canvas');
    canvasElement.width = 200;
    canvasElement.height = 60;
    const ctx = canvasElement.getContext('2d')!;

    // Random background
    const hue = Math.random() * 360;
    ctx.fillStyle = `hsl(${hue}, 70%, 80%)`;
    ctx.fillRect(0, 0, 200, 60);

    // Generate random text (avoid confusing characters)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const answer = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');

    // Add noise lines
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},0.3)`;
      ctx.lineWidth = Math.random() * 2 + 1;
      ctx.beginPath();
      ctx.moveTo(Math.random() * 200, Math.random() * 60);
      ctx.lineTo(Math.random() * 200, Math.random() * 60);
      ctx.stroke();
    }

    // Add noise dots
    for (let i = 0; i < 100; i++) {
      ctx.fillStyle = `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},0.5)`;
      ctx.fillRect(Math.random() * 200, Math.random() * 60, 2, 2);
    }

    // Draw text with random rotation and positioning
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'middle';

    answer.split('').forEach((char, i) => {
      ctx.save();
      const x = 20 + i * 28 + (Math.random() - 0.5) * 8;
      const y = 30 + (Math.random() - 0.5) * 10;
      const rotation = (Math.random() - 0.5) * 0.4;

      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillText(char, 0, 0);
      ctx.restore();
    });

    return {
      dataUrl: canvasElement.toDataURL(),
      answer
    };
  }

  function generateNewCaptcha() {
    const captcha = generateVisualCaptcha();
    captchaDataUrl = captcha.dataUrl;
    captchaAnswer = captcha.answer;

    // Store challenge with same format as original for compatibility
    const challenge = {
      question: 'Visual CAPTCHA',
      answer: captcha.answer.length, // Convert string length to number for compatibility
      timestamp: Date.now()
    };
    storeCaptchaChallenge(challenge);

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
      error = 'Please enter the text you see in the image';
      return;
    }

    if (rateLimited) {
      checkRateLimit();
      return;
    }

    loading = true;

    // Case insensitive comparison
    const isCorrect = userAnswer.trim().toUpperCase() === captchaAnswer.toUpperCase();

    if (isCorrect) {
      dispatch('success', { answer: userAnswer.trim() });
      onSuccess(userAnswer.trim());
    } else {
      error = 'Incorrect text. Please try again.';
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

  // Keyboard support
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleSubmit();
    } else if (event.key === 'Escape') {
      handleCancel();
    }
  }

  // Accessibility: Provide alternative challenge
  function showAudioChallenge() {
    // For now, just refresh with a simpler text-only version
    // In a full implementation, this could play audio of the characters
    generateNewCaptcha();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
    <div class="text-center">
      <h2 class="text-xl font-semibold text-gray-900 mb-2">Security Check</h2>
      <p class="text-sm text-gray-600 mb-4">
        Please enter the text you see in the image below
      </p>

      <div class="bg-gray-50 rounded-lg p-4 mb-4 border-2 border-gray-200">
        {#if captchaDataUrl}
          <img
            src={captchaDataUrl}
            alt="CAPTCHA image with distorted text"
            class="mx-auto rounded"
            style="image-rendering: crisp-edges;"
          />
        {:else}
          <div class="h-16 flex items-center justify-center">
            <div class="animate-pulse text-gray-400">Loading CAPTCHA...</div>
          </div>
        {/if}
      </div>

      <div class="flex items-center gap-2 mb-3">
        <input
          type="text"
          bind:value={userAnswer}
          placeholder="Enter the text you see"
          class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
          autocomplete="off"
          spellcheck="false"
        />
        <button
          type="button"
          on:click={generateNewCaptcha}
          class="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
          disabled={loading || rateLimited}
          title="Get new image"
        >
          🔄
        </button>
      </div>

      {#if error}
        <div class="text-red-500 text-sm mb-4 p-2 bg-red-50 rounded border border-red-200">
          {error}
        </div>
      {/if}

      <form on:submit|preventDefault={handleSubmit}>
        <div class="flex gap-2 mb-3">
          <button
            type="submit"
            class="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || rateLimited}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </div>

        <div class="flex gap-2 justify-center">
          <button
            type="button"
            on:click={showAudioChallenge}
            class="text-xs text-gray-600 hover:text-gray-800 underline"
            title="Alternative challenge option"
          >
            Need help?
          </button>
        </div>

        <button
          type="button"
          on:click={handleCancel}
          class="w-full mt-4 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none"
        >
          Cancel
        </button>
      </form>
    </div>
  </div>
</div>