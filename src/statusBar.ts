import * as vscode from "vscode";
import type { SettingsStore } from "./settings";
import { TOGGLE_COMMAND } from "./commands";

/** Status bar item showing on/off + current mode; click to toggle. */
export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly subscription: vscode.Disposable;

  constructor(private readonly settings: SettingsStore) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.item.command = TOGGLE_COMMAND;
    this.subscription = settings.onDidChange(() => this.update());
    this.update();
    this.item.show();
  }

  update(): void {
    const { enabled, mode } = this.settings.current;
    if (enabled) {
      this.item.text = `$(symbol-ruler) px→tw ${mode}`;
      this.item.tooltip = `Px to Tailwind Plus: on (${mode}) — click to toggle`;
    } else {
      this.item.text = "$(circle-slash) px→tw off";
      this.item.tooltip = "Px to Tailwind Plus: off — click to enable";
    }
  }

  dispose(): void {
    this.subscription.dispose();
    this.item.dispose();
  }
}
