import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    viteSingleFile(),
  ],
  // Use relative paths for VSCode webview compatibility
  base: './',
  build: {
    // Output to dist directory
    outDir: 'dist',
    // Inline all assets for single-file output
    assetsInlineLimit: 1024 * 1024,
    // Don't split CSS
    cssCodeSplit: false,
    // Enable source maps in development
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        // Disable code splitting for single-file webview
        manualChunks: undefined,
        // Consistent naming for easier loading
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    // Minify in production
    minify: mode === 'production',
  },
  // Development server configuration
  server: {
    port: 5173,
    strictPort: false,
    // Allow connections from extension host
    cors: true,
  },
  // Define global constants
  define: {
    __IS_VSCODE__: JSON.stringify(true),
    __DEV__: JSON.stringify(mode === 'development'),
  },
}));
