import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      pages: 'dist/web/app',
      assets: 'dist/web/app',
      fallback: 'index.html',
    }),
    paths: {
      base: process.env.NODE_ENV === 'production' ? '/app' : '',
    },
  },
};

export default config;
