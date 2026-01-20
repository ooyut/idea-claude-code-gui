import * as vscode from 'vscode';
import * as fs from 'fs';
import { BridgeManager } from '../services/BridgeManager';
import { MessageRouter } from '../services/MessageRouter';
import { Logger } from '../utils/logger';

export class CodeMossViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codemoss.panel';

  private _view?: vscode.WebviewView;
  private _messageRouter: MessageRouter;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _bridgeManager: BridgeManager
  ) {
    this._messageRouter = new MessageRouter(_bridgeManager);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist'),
        vscode.Uri.joinPath(this._extensionUri, 'webview', 'src'),
        this._extensionUri
      ]
    };

    webviewView.webview.html = this._getHtmlContent(webviewView.webview);

    // Set up message handling
    this._messageRouter.setWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      message => this._handleMessage(message),
      undefined,
      []
    );

    // Handle visibility changes
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        Logger.debug('Webview became visible');
      }
    });

    Logger.info('WebviewViewProvider resolved successfully');
  }

  private async _handleMessage(message: { type: string; content: unknown; requestId?: string }): Promise<void> {
    Logger.debug('Received message from webview:', message.type);

    try {
      await this._messageRouter.route(message);
    } catch (error) {
      Logger.error('Error handling message:', error);
      this._sendError(message.requestId, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
  }

  private _sendError(requestId: string | undefined, code: string, errorMessage: string): void {
    this._view?.webview.postMessage({
      type: 'error',
      content: { code, message: errorMessage },
      requestId
    });
  }

  public postMessage(message: unknown): void {
    this._view?.webview.postMessage(message);
  }

  public createNewSession(): void {
    this._view?.webview.postMessage({
      type: 'createNewSession',
      content: {}
    });
  }

  public sendSelectionToChat(selection: string): void {
    this._view?.webview.postMessage({
      type: 'insertText',
      content: { text: selection }
    });
    // Focus the panel
    vscode.commands.executeCommand('codemoss.panel.focus');
  }

  private _getHtmlContent(webview: vscode.Webview): string {
    // Check if we have built webview assets
    const distPath = vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist');
    const indexPath = vscode.Uri.joinPath(distPath, 'index.html');

    try {
      // Try to load from built assets
      if (fs.existsSync(indexPath.fsPath)) {
        return this._loadBuiltHtml(webview, distPath);
      }
    } catch (error) {
      Logger.warn('Failed to load built webview, using fallback:', error);
    }

    // Fallback to development HTML
    return this._getDevelopmentHtml(webview);
  }

  private _loadBuiltHtml(webview: vscode.Webview, distPath: vscode.Uri): string {
    const indexPath = vscode.Uri.joinPath(distPath, 'index.html');
    let html = fs.readFileSync(indexPath.fsPath, 'utf8');

    // Convert local paths to webview URIs
    // Handle script sources
    html = html.replace(
      /(src|href)="(\.?\/?)([^"]+)"/g,
      (match, attr, prefix, filePath) => {
        if (filePath.startsWith('http') || filePath.startsWith('data:')) {
          return match;
        }
        const fileUri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, filePath));
        return `${attr}="${fileUri}"`;
      }
    );

    // Inject VSCode API script and CSP
    const nonce = this._getNonce();
    const csp = this._getContentSecurityPolicy(webview, nonce);

    html = html.replace(
      '<head>',
      `<head>
        <meta http-equiv="Content-Security-Policy" content="${csp}">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script nonce="${nonce}">
          window.vscodeApi = acquireVsCodeApi();
          window.isVSCode = true;
        </script>`
    );

    return html;
  }

  private _getDevelopmentHtml(webview: vscode.Webview): string {
    const nonce = this._getNonce();
    const csp = this._getContentSecurityPolicy(webview, nonce);

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="${csp}">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CodeMoss AI Assistant</title>
      <style nonce="${nonce}">
        body {
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          padding: 16px;
          margin: 0;
        }
        .container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 200px;
        }
        h1 {
          font-size: 1.5em;
          margin-bottom: 16px;
        }
        p {
          color: var(--vscode-descriptionForeground);
          margin-bottom: 16px;
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 16px;
          cursor: pointer;
          border-radius: 4px;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        .status {
          margin-top: 16px;
          padding: 8px;
          border-radius: 4px;
          background-color: var(--vscode-textBlockQuote-background);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>CodeMoss AI Assistant</h1>
        <p>Extension loaded successfully!</p>
        <p>Build the webview to see the full UI:</p>
        <code>cd webview && npm run build</code>
        <button id="testBtn">Test Communication</button>
        <div id="status" class="status">Status: Ready</div>
      </div>
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        window.vscodeApi = vscode;
        window.isVSCode = true;

        document.getElementById('testBtn').addEventListener('click', () => {
          vscode.postMessage({ type: 'test', content: 'Hello from webview!' });
          document.getElementById('status').textContent = 'Status: Message sent!';
        });

        window.addEventListener('message', event => {
          const message = event.data;
          console.log('Received message:', message);
          document.getElementById('status').textContent = 'Status: Received ' + message.type;
        });
      </script>
    </body>
    </html>`;
  }

  private _getContentSecurityPolicy(webview: vscode.Webview, _nonce: string): string {
    return [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'unsafe-inline' 'unsafe-eval' ${webview.cspSource}`,
      `img-src ${webview.cspSource} https: data: blob:`,
      `font-src ${webview.cspSource} https: data:`,
      `connect-src ${webview.cspSource} https: wss: ws:`,
      `worker-src ${webview.cspSource} blob:`
    ].join('; ');
  }

  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
