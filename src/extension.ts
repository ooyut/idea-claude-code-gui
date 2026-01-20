import * as vscode from 'vscode';
import { CodeMossViewProvider } from './providers/CodeMossViewProvider';
import { BridgeManager } from './services/BridgeManager';
import { Logger } from './utils/logger';

let bridgeManager: BridgeManager | undefined;

export function activate(context: vscode.ExtensionContext) {
  Logger.info('CodeMoss extension is now activating...');

  // Initialize bridge manager
  bridgeManager = new BridgeManager(context);

  // Create and register webview provider
  const provider = new CodeMossViewProvider(context.extensionUri, bridgeManager);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'codemoss.panel',
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codemoss.openPanel', () => {
      vscode.commands.executeCommand('codemoss.panel.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codemoss.newSession', () => {
      provider.createNewSession();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codemoss.sendSelection', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const selection = editor.document.getText(editor.selection);
        if (selection) {
          provider.sendSelectionToChat(selection);
        }
      }
    })
  );

  // Start bridge process
  bridgeManager.start().catch(err => {
    Logger.error('Failed to start bridge process:', err);
  });

  Logger.info('CodeMoss extension activated successfully');
}

export function deactivate() {
  Logger.info('CodeMoss extension is deactivating...');

  if (bridgeManager) {
    bridgeManager.stop();
  }

  Logger.info('CodeMoss extension deactivated');
}
