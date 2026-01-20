/**
 * Platform Adapter Interface
 * Defines the contract for platform-specific communication
 */

export interface PlatformAdapter {
  /**
   * Platform identifier
   */
  readonly platform: 'vscode' | 'idea' | 'web';

  /**
   * Initialize the adapter
   */
  init(): void;

  /**
   * Send a message to the backend
   */
  send(type: string, content?: unknown): void;

  /**
   * Register a message handler
   */
  onMessage(handler: (message: PlatformMessage) => void): void;

  /**
   * Open a file in the editor
   */
  openFile(filePath: string, line?: number): void;

  /**
   * Open URL in browser
   */
  openBrowser(url: string): void;

  /**
   * Show diff between two contents
   */
  showDiff(filePath: string, oldContent: string, newContent: string, title?: string): void;

  /**
   * Refresh file in the editor
   */
  refreshFile(filePath: string): void;

  /**
   * Check if the adapter is ready
   */
  isReady(): boolean;
}

export interface PlatformMessage {
  type: string;
  content: unknown;
  requestId?: string;
}

/**
 * Message types for webview <-> extension communication
 */
export const MessageTypes = {
  // Session
  SEND_MESSAGE: 'sendMessage',
  MESSAGE_RECEIVED: 'messageReceived',
  STREAM_CHUNK: 'streamChunk',
  STREAM_END: 'streamEnd',
  STREAM_START: 'streamStart',

  // History
  GET_HISTORY: 'getHistory',
  HISTORY_LOADED: 'historyLoaded',
  LOAD_SESSION: 'loadSession',
  SESSION_LOADED: 'sessionLoaded',
  DELETE_SESSION: 'deleteSession',
  CREATE_NEW_SESSION: 'createNewSession',

  // Settings
  GET_SETTINGS: 'getSettings',
  SETTINGS_LOADED: 'settingsLoaded',
  UPDATE_SETTINGS: 'updateSettings',

  // Provider
  GET_PROVIDER_CONFIG: 'getProviderConfig',
  PROVIDER_CONFIG_LOADED: 'providerConfigLoaded',
  UPDATE_PROVIDER_CONFIG: 'updateProviderConfig',
  UPDATE_ACTIVE_PROVIDER: 'updateActiveProvider',

  // Permission
  PERMISSION_REQUEST: 'permissionRequest',
  PERMISSION_RESPONSE: 'permissionResponse',

  // MCP
  GET_MCP_SERVERS: 'getMcpServers',
  MCP_SERVERS_LOADED: 'mcpServersLoaded',
  ADD_MCP_SERVER: 'addMcpServer',
  UPDATE_MCP_SERVER: 'updateMcpServer',
  DELETE_MCP_SERVER: 'deleteMcpServer',

  // Skills
  GET_SKILLS: 'getSkills',
  SKILLS_LOADED: 'skillsLoaded',

  // Agents
  GET_AGENTS: 'getAgents',
  AGENTS_LOADED: 'agentsLoaded',

  // Dependencies
  GET_DEPENDENCIES: 'getDependencies',
  DEPENDENCIES_LOADED: 'dependenciesLoaded',
  INSTALL_DEPENDENCY: 'installDependency',

  // File operations
  OPEN_FILE: 'openFile',
  SHOW_DIFF: 'showDiff',
  REFRESH_FILE: 'refreshFile',

  // UI
  INSERT_TEXT: 'insertText',
  SHOW_ERROR: 'showError',
  SHOW_SUCCESS: 'showSuccess',

  // Error
  ERROR: 'error'
} as const;

export type MessageType = typeof MessageTypes[keyof typeof MessageTypes];
