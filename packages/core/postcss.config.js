import path from 'path';
import { fileURLToPath } from 'url';

const coreSrc = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src');

/** Fallback if Vite ever loads this file. CLI start/build use inline PostCSS with the same `base`. */
export default {
  plugins: {
    '@tailwindcss/postcss': { base: coreSrc },
    autoprefixer: {},
  },
};
