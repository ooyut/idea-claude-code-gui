import type { PlatformAdapter } from './types';
import { VSCodeAdapter } from './VSCodeAdapter';

export * from './types';
export { VSCodeAdapter } from './VSCodeAdapter';

/**
 * Detect the current platform and return the appropriate adapter
 */
export function detectPlatform(): 'vscode' | 'idea' | 'web' {
  // Check for VSCode
  if (
    typeof (window as any).acquireVsCodeApi === 'function' ||
    (window as any).vscodeApi ||
    (window as any).isVSCode
  ) {
    return 'vscode';
  }

  // Check for IDEA (has sendToJava function injected by JCEF)
  if (typeof (window as any).sendToJava === 'function') {
    return 'idea';
  }

  // Default to web
  return 'web';
}

let _adapter: PlatformAdapter | null = null;

/**
 * Get or create the platform adapter singleton
 */
export function getAdapter(): PlatformAdapter {
  if (!_adapter) {
    _adapter = createAdapter();
    _adapter.init();
  }
  return _adapter;
}

/**
 * Create a new adapter based on the detected platform
 */
export function createAdapter(): PlatformAdapter {
  const platform = detectPlatform();

  switch (platform) {
    case 'vscode':
      console.log('[Platform] Creating VSCode adapter');
      return new VSCodeAdapter();

    case 'idea':
      // For IDEA, we use the legacy bridge.ts approach
      // This is a fallback that should not be reached in VSCode-only build
      console.warn('[Platform] IDEA platform detected but not supported in this build');
      return new VSCodeAdapter(); // Fallback to VSCode adapter

    case 'web':
    default:
      console.warn('[Platform] Web platform detected, using VSCode adapter as fallback');
      return new VSCodeAdapter();
  }
}

/**
 * Check if the current platform is VSCode
 */
export function isVSCode(): boolean {
  return detectPlatform() === 'vscode';
}

/**
 * Check if the current platform is IDEA
 */
export function isIDEA(): boolean {
  return detectPlatform() === 'idea';
}

/**
 * Initialize the platform adapter
 * Call this early in the application lifecycle
 */
export function initPlatform(): PlatformAdapter {
  return getAdapter();
}
