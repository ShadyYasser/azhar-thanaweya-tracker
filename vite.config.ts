import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from /<repo>/.
export default defineConfig({
  base: '/azhar-thanaweya-tracker/',
  plugins: [react()],
});
