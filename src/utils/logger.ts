import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('CodeMoss');
  }
  return outputChannel;
}

function formatMessage(level: string, message: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const formattedArgs = args.length > 0
    ? ' ' + args.map(arg => {
        if (arg instanceof Error) {
          return arg.stack || arg.message;
        }
        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
      }).join(' ')
    : '';
  return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
}

export const Logger = {
  debug(message: string, ...args: unknown[]): void {
    const formatted = formatMessage('DEBUG', message, ...args);
    getOutputChannel().appendLine(formatted);
    console.log(formatted);
  },

  info(message: string, ...args: unknown[]): void {
    const formatted = formatMessage('INFO', message, ...args);
    getOutputChannel().appendLine(formatted);
    console.log(formatted);
  },

  warn(message: string, ...args: unknown[]): void {
    const formatted = formatMessage('WARN', message, ...args);
    getOutputChannel().appendLine(formatted);
    console.warn(formatted);
  },

  error(message: string, ...args: unknown[]): void {
    const formatted = formatMessage('ERROR', message, ...args);
    getOutputChannel().appendLine(formatted);
    console.error(formatted);
  },

  show(): void {
    getOutputChannel().show();
  },

  dispose(): void {
    if (outputChannel) {
      outputChannel.dispose();
      outputChannel = undefined;
    }
  }
};
