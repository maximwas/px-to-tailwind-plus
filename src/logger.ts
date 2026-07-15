import * as vscode from "vscode";

/**
 * Thin wrapper around a VS Code OutputChannel. Created once on activation and
 * surfaced through the "Px to Tailwind Plus: Show Logs" command.
 */
export class Logger implements vscode.Disposable {
  private readonly channel: vscode.OutputChannel;

  constructor(name = "Px to Tailwind Plus") {
    this.channel = vscode.window.createOutputChannel(name);
  }

  info(message: string): void {
    this.write("INFO", message);
  }

  warn(message: string): void {
    this.write("WARN", message);
  }

  error(message: string, error?: unknown): void {
    const detail = error instanceof Error ? `: ${error.message}` : error ? `: ${String(error)}` : "";
    this.write("ERROR", message + detail);
  }

  show(): void {
    this.channel.show(true);
  }

  private write(level: string, message: string): void {
    const timestamp = new Date().toISOString().slice(11, 23);
    this.channel.appendLine(`[${timestamp}] ${level}  ${message}`);
  }

  dispose(): void {
    this.channel.dispose();
  }
}
