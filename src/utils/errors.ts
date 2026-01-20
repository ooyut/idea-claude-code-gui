import * as vscode from 'vscode';
import { Logger } from './logger';

/**
 * Error codes for the extension
 */
export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  BRIDGE_NOT_RUNNING = 'BRIDGE_NOT_RUNNING',
  BRIDGE_START_FAILED = 'BRIDGE_START_FAILED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  INVALID_REQUEST = 'INVALID_REQUEST',
  TIMEOUT = 'TIMEOUT',
  SDK_NOT_INSTALLED = 'SDK_NOT_INSTALLED',
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
}

/**
 * Extension error class
 */
export class ExtensionError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
    this.details = details;
  }

  public toJSON(): object {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  /**
   * Show error notification to user
   */
  public static showError(
    message: string,
    options?: {
      modal?: boolean;
      actions?: { title: string; action: () => void }[];
    }
  ): void {
    Logger.error(message);

    if (options?.actions && options.actions.length > 0) {
      const actionTitles = options.actions.map(a => a.title);
      vscode.window.showErrorMessage(message, ...actionTitles).then(selected => {
        const action = options.actions?.find(a => a.title === selected);
        action?.action();
      });
    } else {
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Show warning notification to user
   */
  public static showWarning(message: string): void {
    Logger.warn(message);
    vscode.window.showWarningMessage(message);
  }

  /**
   * Show info notification to user
   */
  public static showInfo(message: string): void {
    Logger.info(message);
    vscode.window.showInformationMessage(message);
  }

  /**
   * Handle error with retry option
   */
  public static async handleWithRetry<T>(
    operation: () => Promise<T>,
    errorMessage: string,
    maxRetries: number = 3
  ): Promise<T | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        Logger.warn(`Attempt ${attempt}/${maxRetries} failed:`, lastError.message);

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    this.showError(`${errorMessage}: ${lastError?.message}`, {
      actions: [
        {
          title: 'Retry',
          action: () => this.handleWithRetry(operation, errorMessage, maxRetries),
        },
      ],
    });

    return null;
  }

  /**
   * Format error for display
   */
  public static formatError(error: unknown): string {
    if (error instanceof ExtensionError) {
      return `[${error.code}] ${error.message}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
