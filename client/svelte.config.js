import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "404.html",
      precompress: false,
      strict: true,
    }),
    paths: {
      // This reads the env var we set in deploy.yml
      base: process.env.BASE_PATH || "",
    },
    // Explicitly set the app directory if you move things around,
    // but default is usually fine.
    files: {
      assets: "static",
      lib: "src/lib",
      routes: "src/routes",
    },
  },
};

export default config;
