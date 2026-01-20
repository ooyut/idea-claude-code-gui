import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

/**
 * File Handler
 * Handles file operations using VSCode FileSystem API
 */
export class FileHandler {
  /**
   * Open a file in the editor
   */
  public static async openFile(filePath: string, line?: number, column?: number): Promise<boolean> {
    try {
      const uri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);

      if (line !== undefined) {
        const position = new vscode.Position(Math.max(0, line - 1), column || 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      }

      return true;
    } catch (error) {
      Logger.error('Failed to open file:', filePath, error);
      return false;
    }
  }

  /**
   * Read file content
   */
  public static async readFile(filePath: string): Promise<string | null> {
    try {
      const uri = vscode.Uri.file(filePath);
      const content = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(content).toString('utf-8');
    } catch (error) {
      Logger.error('Failed to read file:', filePath, error);
      return null;
    }
  }

  /**
   * Write file content
   */
  public static async writeFile(filePath: string, content: string): Promise<boolean> {
    try {
      const uri = vscode.Uri.file(filePath);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
      return true;
    } catch (error) {
      Logger.error('Failed to write file:', filePath, error);
      return false;
    }
  }

  /**
   * Check if file exists
   */
  public static async exists(filePath: string): Promise<boolean> {
    try {
      const uri = vscode.Uri.file(filePath);
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Refresh file from disk (reload in editor if open)
   */
  public static async refreshFile(filePath: string): Promise<boolean> {
    try {
      const uri = vscode.Uri.file(filePath);

      // Find if the file is already open
      const openEditor = vscode.window.visibleTextEditors.find(
        editor => editor.document.uri.fsPath === filePath
      );

      if (openEditor) {
        // Revert the document to reload from disk
        await vscode.commands.executeCommand('workbench.action.files.revert', uri);
      }

      return true;
    } catch (error) {
      Logger.error('Failed to refresh file:', filePath, error);
      return false;
    }
  }

  /**
   * Open browser/external URL
   */
  public static async openExternal(url: string): Promise<boolean> {
    try {
      const uri = vscode.Uri.parse(url);
      await vscode.env.openExternal(uri);
      return true;
    } catch (error) {
      Logger.error('Failed to open external URL:', url, error);
      return false;
    }
  }
}
