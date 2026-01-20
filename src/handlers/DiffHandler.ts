import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { Logger } from '../utils/logger';

/**
 * Diff Handler
 * Handles diff display using VSCode Diff Editor
 */
export class DiffHandler {
  private static _tempDir = path.join(os.tmpdir(), 'codemoss-diff');

  /**
   * Show diff between two files
   */
  public static async showFileDiff(
    originalPath: string,
    modifiedPath: string,
    title?: string
  ): Promise<boolean> {
    try {
      const originalUri = vscode.Uri.file(originalPath);
      const modifiedUri = vscode.Uri.file(modifiedPath);

      await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        modifiedUri,
        title || `${path.basename(originalPath)} ↔ ${path.basename(modifiedPath)}`
      );

      return true;
    } catch (error) {
      Logger.error('Failed to show file diff:', error);
      return false;
    }
  }

  /**
   * Show diff between content strings
   */
  public static async showContentDiff(
    originalContent: string,
    modifiedContent: string,
    fileName: string,
    title?: string
  ): Promise<boolean> {
    try {
      // Ensure temp directory exists
      if (!fs.existsSync(this._tempDir)) {
        fs.mkdirSync(this._tempDir, { recursive: true });
      }

      // Create temp files for diff
      const timestamp = Date.now();
      const originalPath = path.join(this._tempDir, `original-${timestamp}-${fileName}`);
      const modifiedPath = path.join(this._tempDir, `modified-${timestamp}-${fileName}`);

      fs.writeFileSync(originalPath, originalContent, 'utf-8');
      fs.writeFileSync(modifiedPath, modifiedContent, 'utf-8');

      const originalUri = vscode.Uri.file(originalPath);
      const modifiedUri = vscode.Uri.file(modifiedPath);

      await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        modifiedUri,
        title || `${fileName} (Original ↔ Modified)`
      );

      // Clean up temp files after a delay
      setTimeout(() => {
        try {
          if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
          if (fs.existsSync(modifiedPath)) fs.unlinkSync(modifiedPath);
        } catch {
          // Ignore cleanup errors
        }
      }, 60000); // 1 minute delay

      return true;
    } catch (error) {
      Logger.error('Failed to show content diff:', error);
      return false;
    }
  }

  /**
   * Show diff for a file with proposed changes
   */
  public static async showProposedChanges(
    filePath: string,
    proposedContent: string,
    title?: string
  ): Promise<boolean> {
    try {
      const originalUri = vscode.Uri.file(filePath);

      // Read original content
      let originalContent = '';
      try {
        const document = await vscode.workspace.openTextDocument(originalUri);
        originalContent = document.getText();
      } catch {
        // File might not exist, use empty content
        originalContent = '';
      }

      return this.showContentDiff(
        originalContent,
        proposedContent,
        path.basename(filePath),
        title || `${path.basename(filePath)} - Proposed Changes`
      );
    } catch (error) {
      Logger.error('Failed to show proposed changes:', error);
      return false;
    }
  }

  /**
   * Clean up all temp files
   */
  public static cleanup(): void {
    try {
      if (fs.existsSync(this._tempDir)) {
        const files = fs.readdirSync(this._tempDir);
        for (const file of files) {
          fs.unlinkSync(path.join(this._tempDir, file));
        }
      }
    } catch (error) {
      Logger.warn('Failed to cleanup diff temp files:', error);
    }
  }
}
