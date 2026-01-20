import type { PlatformAdapter, PlatformMessage } from './types';
import { MessageTypes } from './types';

/**
 * VSCode API interface
 */
interface VSCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

/**
 * VSCode Platform Adapter
 * Handles communication between webview and VSCode Extension Host
 */
export class VSCodeAdapter implements PlatformAdapter {
  readonly platform = 'vscode' as const;

  private _vscode: VSCodeApi | null = null;
  private _messageHandlers: ((message: PlatformMessage) => void)[] = [];
  private _ready = false;
  private _pendingMessages: { type: string; content: unknown }[] = [];
  private _requestIdCounter = 0;
  private _pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();

  constructor() {
    // Try to get VSCode API
    this._initVSCodeApi();
  }

  private _initVSCodeApi(): void {
    try {
      // Check if we're in VSCode webview
      if (typeof acquireVsCodeApi === 'function') {
        // Only call acquireVsCodeApi once
        if ((window as any).vscodeApi) {
          this._vscode = (window as any).vscodeApi;
        } else {
          this._vscode = acquireVsCodeApi();
          (window as any).vscodeApi = this._vscode;
        }
        this._ready = true;
        console.log('[VSCodeAdapter] VSCode API initialized');
      } else if ((window as any).vscodeApi) {
        // API was already acquired (e.g., by extension host)
        this._vscode = (window as any).vscodeApi;
        this._ready = true;
        console.log('[VSCodeAdapter] Using existing VSCode API');
      }
    } catch (error) {
      console.warn('[VSCodeAdapter] Failed to acquire VSCode API:', error);
    }
  }

  init(): void {
    if (!this._vscode) {
      console.warn('[VSCodeAdapter] VSCode API not available');
      return;
    }

    // Set up message listener
    window.addEventListener('message', (event) => {
      const message = event.data as PlatformMessage;
      this._handleMessage(message);
    });

    // Send any pending messages
    this._pendingMessages.forEach(msg => this.send(msg.type, msg.content));
    this._pendingMessages = [];

    // Register global callback functions for compatibility
    this._registerGlobalCallbacks();

    console.log('[VSCodeAdapter] Initialized');
  }

  private _handleMessage(message: PlatformMessage): void {
    console.log('[VSCodeAdapter] Received message:', message.type);

    // Check if this is a response to a pending request
    if (message.requestId && this._pendingRequests.has(message.requestId)) {
      const pending = this._pendingRequests.get(message.requestId)!;
      clearTimeout(pending.timeout);
      this._pendingRequests.delete(message.requestId);

      if (message.type === MessageTypes.ERROR) {
        pending.reject(new Error((message.content as { message: string }).message));
      } else {
        pending.resolve(message.content);
      }
      return;
    }

    // Call registered handlers
    this._messageHandlers.forEach(handler => handler(message));

    // Call legacy global callbacks for backward compatibility
    this._callLegacyCallback(message);
  }

  private _callLegacyCallback(message: PlatformMessage): void {
    const { type, content } = message;

    // Map message types to legacy window callbacks
    const callbackMap: Record<string, string> = {
      [MessageTypes.STREAM_CHUNK]: 'onContentDelta',
      [MessageTypes.STREAM_START]: 'onStreamStart',
      [MessageTypes.STREAM_END]: 'onStreamEnd',
      thinkingChunk: 'onThinkingDelta',
      [MessageTypes.PERMISSION_REQUEST]: 'showPermissionDialog',
      [MessageTypes.HISTORY_LOADED]: 'setHistoryData',
      updateMessages: 'updateMessages',
      sessionExported: 'onExportSessionData',
      providersLoaded: 'updateProviders',
      codexProvidersLoaded: 'updateCodexProviders',
      currentClaudeConfigLoaded: 'updateCurrentClaudeConfig',
      currentClaudeConfigUpdated: 'updateCurrentClaudeConfig',
      activeProviderLoaded: 'updateActiveProvider',
      activeProviderUpdated: 'updateActiveProvider',
      nodePathLoaded: 'updateNodePath',
      nodePathSet: 'updateNodePath',
      workingDirectoryLoaded: 'updateWorkingDirectory',
      workingDirectorySet: 'updateWorkingDirectory',
      editorFontConfigLoaded: 'onEditorFontConfigReceived',
      mcpServerStatusLoaded: 'updateMcpServerStatus',
      usageStatisticsLoaded: 'updateUsageStatistics',
      streamingEnabledLoaded: 'updateStreamingEnabled',
      streamingEnabledUpdated: 'updateStreamingEnabled',
      sendShortcutLoaded: 'updateSendShortcut',
      sendShortcutUpdated: 'updateSendShortcut',
      thinkingEnabledLoaded: 'updateThinkingEnabled',
      thinkingEnabledUpdated: 'updateThinkingEnabled',
      import_preview_result: 'import_preview_result',
      backend_notification: 'backend_notification',
      [MessageTypes.MCP_SERVERS_LOADED]: 'updateMcpServers',
      [MessageTypes.SKILLS_LOADED]: 'updateSkills',
      [MessageTypes.AGENTS_LOADED]: 'updateAgents',
      agentOperationResult: 'agentOperationResult',
      selectedAgentLoaded: 'onSelectedAgentReceived',
      selectedAgentChanged: 'onSelectedAgentChanged',
      [MessageTypes.DEPENDENCIES_LOADED]: 'updateDependencyStatus',
      skillImported: 'skillImportResult',
      skillDeleted: 'skillDeleteResult',
      skillToggled: 'skillToggleResult',
      mcpServerToggled: 'mcpServerToggled',
      mcpServerAdded: 'mcpServerAdded',
      mcpServerUpdated: 'mcpServerUpdated',
      mcpServerDeleted: 'mcpServerDeleted',
      dependencyInstallProgress: 'dependencyInstallProgress',
      dependencyInstallResult: 'dependencyInstallResult',
      dependencyUninstallResult: 'dependencyUninstallResult',
      nodeEnvironmentStatus: 'nodeEnvironmentStatus',
      error: 'showError',
      [MessageTypes.SHOW_ERROR]: 'showError',
      [MessageTypes.SHOW_SUCCESS]: 'showSuccess',
      showSwitchSuccess: 'showSwitchSuccess',
      [MessageTypes.INSERT_TEXT]: 'addUserMessage',
      [MessageTypes.CREATE_NEW_SESSION]: 'clearMessages',
    };

    let callbackName = callbackMap[type];

    if (type === 'mcpServersLoaded') {
      if (typeof (window as any).updateCodexMcpServers === 'function') {
        callbackName = 'updateCodexMcpServers';
      }
    }

    if (type === 'mcpServerToggled') {
      if (typeof (window as any).codexMcpServerToggled === 'function') {
        callbackName = 'codexMcpServerToggled';
      }
    }

    if (type === 'mcpServerAdded') {
      if (typeof (window as any).codexMcpServerAdded === 'function') {
        callbackName = 'codexMcpServerAdded';
      }
    }

    if (type === 'mcpServerUpdated') {
      if (typeof (window as any).codexMcpServerUpdated === 'function') {
        callbackName = 'codexMcpServerUpdated';
      }
    }

    if (type === 'mcpServerDeleted') {
      if (typeof (window as any).codexMcpServerDeleted === 'function') {
        callbackName = 'codexMcpServerDeleted';
      }
    }

    if (callbackName && typeof (window as any)[callbackName] === 'function') {
      if (type === MessageTypes.STREAM_CHUNK || type === 'thinkingChunk') {
        console.log('[VSCodeAdapter] streamChunk content:', JSON.stringify(content));
        const delta = typeof content === 'object' && content !== null
          ? (content as { delta?: string }).delta || ''
          : (typeof content === 'string' ? content : '');
        console.log('[VSCodeAdapter] Extracted delta:', JSON.stringify(delta), 'length:', delta.length);
        if (delta) {
          (window as any)[callbackName](delta);
          console.log('[VSCodeAdapter] Called onContentDelta with delta');
        } else {
          console.log('[VSCodeAdapter] Delta is empty, skipping onContentDelta');
        }
        return;
      }

      if (callbackName === 'setHistoryData') {
        (window as any)[callbackName](content);
        return;
      }

      if (callbackName === 'addUserMessage' && typeof content === 'object' && content !== null && 'text' in (content as any)) {
        (window as any)[callbackName](String((content as any).text ?? ''));
        return;
      }

      if (
        callbackName === 'showError' ||
        callbackName === 'showSuccess' ||
        callbackName === 'showSwitchSuccess'
      ) {
        if (typeof content === 'string') {
          (window as any)[callbackName](content);
          return;
        }
        if (typeof content === 'object' && content !== null && 'message' in (content as any)) {
          (window as any)[callbackName](String((content as any).message ?? ''));
          return;
        }
      }

      const payload = typeof content === 'string' ? content : JSON.stringify(content);
      (window as any)[callbackName](payload);
    } else {
      if (callbackName) {
        console.log('[VSCodeAdapter] No callback found for type:', type, 'callbackName:', callbackName);
      }
    }
  }

  private _registerGlobalCallbacks(): void {
    // Register sendToJava replacement for backward compatibility
    (window as any).sendToJava = (payload: string) => {
      // Parse the legacy format: "event_type:content"
      const colonIndex = payload.indexOf(':');
      if (colonIndex === -1) {
        this.send(payload);
        return;
      }

      const type = payload.substring(0, colonIndex);
      const content = payload.substring(colonIndex + 1);

      // Map legacy event types to new message types
      const typeMap: Record<string, string> = {
        'send_message': MessageTypes.SEND_MESSAGE,
        'open_file': MessageTypes.OPEN_FILE,
        'open_browser': 'openBrowser',
        'refresh_file': MessageTypes.REFRESH_FILE,
        'show_diff': MessageTypes.SHOW_DIFF,
        'get_history': MessageTypes.GET_HISTORY,
        'load_session': MessageTypes.LOAD_SESSION,
        'delete_session': MessageTypes.DELETE_SESSION,
        'get_settings': MessageTypes.GET_SETTINGS,
        'update_settings': MessageTypes.UPDATE_SETTINGS,
        'permission_response': MessageTypes.PERMISSION_RESPONSE,
        // Dependency-related mappings
        'get_dependency_status': 'getDependencies',
        'check_node_environment': 'checkNodeEnvironment',
        'install_dependency': 'installDependency',
        'uninstall_dependency': 'uninstallDependency',
      };

      const mappedType = typeMap[type] || type;

      try {
        const parsedContent = JSON.parse(content);
        this.send(mappedType, parsedContent);
      } catch {
        this.send(mappedType, content);
      }
    };

    console.log('[VSCodeAdapter] Global callbacks registered');
  }

  send(type: string, content?: unknown): void {
    if (!this._vscode) {
      console.warn('[VSCodeAdapter] Queueing message (API not ready):', type);
      this._pendingMessages.push({ type, content });
      return;
    }

    const message = { type, content };
    console.log('[VSCodeAdapter] Sending message:', type);
    this._vscode.postMessage(message);
  }

  /**
   * Send a message and wait for response
   */
  async sendAndWait<T>(type: string, content?: unknown, timeout = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = `req_${++this._requestIdCounter}_${Date.now()}`;

      const timeoutHandle = setTimeout(() => {
        this._pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${type}`));
      }, timeout);

      this._pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutHandle
      });

      if (this._vscode) {
        this._vscode.postMessage({ type, content, requestId });
      } else {
        clearTimeout(timeoutHandle);
        this._pendingRequests.delete(requestId);
        reject(new Error('VSCode API not available'));
      }
    });
  }

  onMessage(handler: (message: PlatformMessage) => void): void {
    this._messageHandlers.push(handler);
  }

  offMessage(handler: (message: PlatformMessage) => void): void {
    const index = this._messageHandlers.indexOf(handler);
    if (index > -1) {
      this._messageHandlers.splice(index, 1);
    }
  }

  openFile(filePath: string, line?: number): void {
    this.send(MessageTypes.OPEN_FILE, { path: filePath, line });
  }

  openBrowser(url: string): void {
    this.send('openBrowser', { url });
  }

  showDiff(filePath: string, oldContent: string, newContent: string, title?: string): void {
    this.send(MessageTypes.SHOW_DIFF, { filePath, oldContent, newContent, title });
  }

  refreshFile(filePath: string): void {
    this.send(MessageTypes.REFRESH_FILE, { filePath });
  }

  isReady(): boolean {
    return this._ready;
  }

  /**
   * Get state persisted by VSCode
   */
  getState<T>(): T | undefined {
    return this._vscode?.getState() as T | undefined;
  }

  /**
   * Persist state in VSCode
   */
  setState<T>(state: T): void {
    this._vscode?.setState(state);
  }
}

// Declare global function for type checking
declare function acquireVsCodeApi(): VSCodeApi;
