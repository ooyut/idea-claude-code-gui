import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '../utils/logger';

/**
 * Configuration file paths
 */
const CONFIG_DIR = path.join(os.homedir(), '.codemoss');
const SESSIONS_DIR = path.join(CONFIG_DIR, 'sessions');

export interface ConfigPaths {
  configDir: string;
  sessionsDir: string;
  settingsFile: string;
  claudeConfigFile: string;
  codexConfigFile: string;
  mcpServersFile: string;
  skillsFile: string;
  agentsFile: string;
}

/**
 * Configuration Service
 * Handles reading and writing configuration files from ~/.codemoss/
 */
export class ConfigService {
  private static _instance: ConfigService | null = null;
  private _cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private _cacheTTL = 5000; // 5 seconds cache TTL

  private constructor() {
    this._ensureDirectories();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService._instance) {
      ConfigService._instance = new ConfigService();
    }
    return ConfigService._instance;
  }

  /**
   * Get configuration paths
   */
  public getPaths(): ConfigPaths {
    return {
      configDir: CONFIG_DIR,
      sessionsDir: SESSIONS_DIR,
      settingsFile: path.join(CONFIG_DIR, 'settings.json'),
      claudeConfigFile: path.join(CONFIG_DIR, 'claude-config.json'),
      codexConfigFile: path.join(CONFIG_DIR, 'codex-config.json'),
      mcpServersFile: path.join(CONFIG_DIR, 'mcp-servers.json'),
      skillsFile: path.join(CONFIG_DIR, 'skills.json'),
      agentsFile: path.join(CONFIG_DIR, 'agents.json'),
    };
  }

  /**
   * Ensure configuration directories exist
   */
  private _ensureDirectories(): void {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        Logger.info('Created config directory:', CONFIG_DIR);
      }
      if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
        Logger.info('Created sessions directory:', SESSIONS_DIR);
      }
    } catch (error) {
      Logger.error('Failed to create config directories:', error);
    }
  }

  /**
   * Read JSON file
   */
  public readJson<T>(filePath: string, defaultValue: T): T {
    // Check cache
    const cached = this._cache.get(filePath);
    if (cached && Date.now() - cached.timestamp < this._cacheTTL) {
      return cached.data as T;
    }

    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content) as T;
        this._cache.set(filePath, { data, timestamp: Date.now() });
        return data;
      }
    } catch (error) {
      Logger.warn(`Failed to read ${filePath}:`, error);
    }

    return defaultValue;
  }

  /**
   * Write JSON file
   */
  public writeJson<T>(filePath: string, data: T): boolean {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      this._cache.set(filePath, { data, timestamp: Date.now() });
      Logger.debug('Written config file:', filePath);
      return true;
    } catch (error) {
      Logger.error(`Failed to write ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Delete file
   */
  public deleteFile(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this._cache.delete(filePath);
        return true;
      }
      return false;
    } catch (error) {
      Logger.error(`Failed to delete ${filePath}:`, error);
      return false;
    }
  }

  /**
   * List files in directory
   */
  public listFiles(dirPath: string, extension?: string): string[] {
    try {
      if (!fs.existsSync(dirPath)) {
        return [];
      }

      let files = fs.readdirSync(dirPath);
      if (extension) {
        files = files.filter(f => f.endsWith(extension));
      }
      return files.map(f => path.join(dirPath, f));
    } catch (error) {
      Logger.error(`Failed to list files in ${dirPath}:`, error);
      return [];
    }
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this._cache.clear();
  }

  /**
   * Get workspace working directory
   */
  public getWorkingDirectory(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath;
    }
    return undefined;
  }
}
