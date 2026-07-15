/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */

// Minimal runtime stub of the VS Code API used for unit tests.

class Disposable {
  private callback?: () => void;

  constructor(callback?: () => void) {
    this.callback = callback;
  }

  dispose(): void {
    if (this.callback) {
      try {
        this.callback();
      } finally {
        this.callback = undefined;
      }
    }
  }
}

class Position {
  line: number;
  character: number;

  constructor(line: number, character: number) {
    this.line = line;
    this.character = character;
  }

  isBefore(other: Position): boolean {
    return this.line < other.line || (this.line === other.line && this.character < other.character);
  }

  isBeforeOrEqual(other: Position): boolean {
    return this.isBefore(other) || this.isEqual(other);
  }

  isAfter(other: Position): boolean {
    return other.isBefore(this);
  }

  isEqual(other: Position): boolean {
    return this.line === other.line && this.character === other.character;
  }

  translate(lineDelta = 0, characterDelta = 0): Position {
    return new Position(this.line + lineDelta, this.character + characterDelta);
  }

  with(line = this.line, character = this.character): Position {
    return new Position(line, character);
  }
}

class Range {
  start: Position;
  end: Position;

  constructor(start: Position | number, end: Position | number, endLine?: number, endCharacter?: number) {
    if (start instanceof Position && end instanceof Position) {
      this.start = start;
      this.end = end;
    } else if (typeof start === 'number' && typeof end === 'number' && typeof endLine === 'number' && typeof endCharacter === 'number') {
      this.start = new Position(start, end);
      this.end = new Position(endLine, endCharacter);
    } else {
      throw new Error('Invalid Range constructor arguments');
    }
  }

  get isEmpty(): boolean {
    return this.start.isEqual(this.end);
  }

  contains(positionOrRange: Position | Range): boolean {
    if (positionOrRange instanceof Range) {
      return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
    }

    return !positionOrRange.isBefore(this.start) && !positionOrRange.isAfter(this.end);
  }

  isEqual(other: Range): boolean {
    return this.start.isEqual(other.start) && this.end.isEqual(other.end);
  }

  with(start: Position = this.start, end: Position = this.end): Range {
    return new Range(start, end);
  }
}

class Selection extends Range {
  anchor: Position;
  active: Position;

  constructor(anchor: Position, active: Position) {
    super(anchor, active);
    this.anchor = anchor;
    this.active = active;
  }
}

let uriCounter = 0;

class Uri {
  scheme: string;
  path: string;
  fsPath: string;

  private constructor(scheme: string, path: string) {
    this.scheme = scheme;
    this.path = path;
    this.fsPath = path;
  }

  static file(path: string): Uri {
    return new Uri('file', path);
  }

  static parse(value: string): Uri {
    const [scheme, rest] = value.includes(':') ? value.split(':') : ['file', value];
    return new Uri(scheme, rest || `/mock/${++uriCounter}`);
  }

  toString(): string {
    return `${this.scheme}:${this.path}`;
  }

  with(change: { scheme?: string; path?: string }): Uri {
    return Uri.parse(`${change.scheme ?? this.scheme}:${change.path ?? this.path}`);
  }
}

class MarkdownString {
  private value = '';
  isTrusted = false;

  appendMarkdown(text: string): MarkdownString {
    this.value += text;
    return this;
  }

  appendCodeblock(code: string, language = ''): MarkdownString {
    this.value += `
\`\`\`${language}\n${code}\n\`\`\`
`;
    return this;
  }

  toString(): string {
    return this.value;
  }
}

class ThemeColor {
  id: string;

  constructor(id: string) {
    this.id = id;
  }
}

class Hover {
  contents: Array<string | MarkdownString>;
  range?: Range;

  constructor(contents: string | MarkdownString | Array<string | MarkdownString>, range?: Range) {
    this.contents = Array.isArray(contents) ? contents : [contents];
    this.range = range;
  }
}

class TextEditorDecorationType {
  readonly key: string;
  readonly options: any;

  constructor(options: any) {
    this.key = Math.random().toString(36).slice(2);
    this.options = options;
  }

  dispose(): void {
    // No-op for tests
  }
}

class OutputChannel {
  readonly name: string;
  private lines: string[] = [];

  constructor(name: string) {
    this.name = name;
  }

  appendLine(value: string): void {
    this.lines.push(value);
  }

  clear(): void {
    this.lines = [];
  }

  show(): void {
    // No-op
  }

  hide(): void {
    // No-op
  }

  dispose(): void {
    this.lines = [];
  }
}

class CancellationToken {
  isCancellationRequested = false;
  onCancellationRequested(): Disposable {
    return new Disposable();
  }
}

class CancellationTokenSource {
  token: CancellationToken;

  constructor() {
    this.token = new CancellationToken();
  }

  cancel(): void {
    this.token.isCancellationRequested = true;
  }

  dispose(): void {
    this.cancel();
  }
}

interface WorkspaceEditEntry {
  uri: Uri;
  range: Range;
  newText: string;
}

class WorkspaceEdit {
  private readonly edits: WorkspaceEditEntry[] = [];

  replace(uri: Uri, range: Range, newText: string): void {
    this.edits.push({ uri, range, newText });
  }

  get entries(): WorkspaceEditEntry[] {
    return this.edits;
  }
}

const OverviewRulerLane = {
  Left: 1,
  Center: 2,
  Right: 4,
  Full: 7,
} as const;

type ConfigurationSection = Record<string, any>;

const configurationStore: Record<string, ConfigurationSection> = {
  pxToTailwind: {
    enabled: true,
    supportedFileTypes: [
      'html',
      'javascript',
      'typescript',
      'javascriptreact',
      'typescriptreact',
      'vue',
      'svelte',
    ],
    customSpacingScale: undefined,
    showVisualFeedback: true,
    showHoverTooltips: true,
  },
};

class WorkspaceConfiguration {
  private readonly section: string;

  constructor(section: string) {
    this.section = section;
  }

  private ensureSection(): ConfigurationSection {
    if (!configurationStore[this.section]) {
      configurationStore[this.section] = {};
    }
    return configurationStore[this.section];
  }

  get<T>(key: string, defaultValue?: T): T {
    const section = this.ensureSection();
    const value = key in section ? section[key] : undefined;
    return (value !== undefined ? value : defaultValue) as T;
  }

  async update(key: string, value: any): Promise<void> {
    const section = this.ensureSection();
    section[key] = value;
  }
}

const configurationListeners = new Set<(event: { affectsConfiguration: (section: string) => boolean }) => void>();

function fireConfigurationChange(section: string): void {
  const event = {
    affectsConfiguration: (testSection: string) => testSection === section,
  };
  configurationListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.error('Configuration listener error', error);
    }
  });
}

type TextDocument = {
  uri: Uri;
  languageId: string;
  isDirty: boolean;
  isUntitled: boolean;
  lineCount: number;
  getText(range?: Range): string;
  lineAt(line: number): { text: string; range: Range; lineNumber: number; isEmptyOrWhitespace: boolean };
  save(): Promise<boolean>;
};

function createMockTextDocument(content: string, languageId: string): TextDocument {
  const uri = Uri.parse(`mock:${++uriCounter}`);

  const getLines = () => content.split(/\r?\n/);

  return {
    uri,
    languageId,
    isDirty: false,
    isUntitled: true,
    get lineCount() {
      return getLines().length;
    },
    getText(range?: Range) {
      if (!range) {
        return content;
      }

      const lines = getLines();
      const startLine = Math.max(0, Math.min(range.start.line, lines.length - 1));
      const endLine = Math.max(0, Math.min(range.end.line, lines.length - 1));

      if (startLine === endLine) {
        const line = lines[startLine] ?? '';
        return line.substring(range.start.character, range.end.character);
      }

      const selectedLines = lines.slice(startLine, endLine + 1);
      if (selectedLines.length === 0) {
        return '';
      }

      selectedLines[0] = (selectedLines[0] ?? '').substring(range.start.character);
      const lastIndex = selectedLines.length - 1;
      selectedLines[lastIndex] = (selectedLines[lastIndex] ?? '').substring(0, range.end.character);
      return selectedLines.join('\n');
    },
    lineAt(line: number) {
      const lines = getLines();
      const text = lines[line] ?? '';
      return {
        text,
        lineNumber: line,
        range: new Range(new Position(line, 0), new Position(line, text.length)),
        isEmptyOrWhitespace: text.trim().length === 0,
      };
    },
    async save() {
      return true;
    },
  };
}

const workspace = {
  workspaceFolders: [] as Array<{ uri: Uri }> | undefined,

  getConfiguration(section = 'pxToTailwind'): WorkspaceConfiguration {
    return new WorkspaceConfiguration(section);
  },

  async openTextDocument(options: any): Promise<TextDocument> {
    if (typeof options === 'string') {
      return createMockTextDocument('', 'plaintext');
    }

    const content = options?.content ?? '';
    const language = options?.language ?? 'plaintext';
    return createMockTextDocument(content, language);
  },

  onDidChangeConfiguration(listener: (event: { affectsConfiguration: (section: string) => boolean }) => void): Disposable {
    configurationListeners.add(listener);
    return new Disposable(() => configurationListeners.delete(listener));
  },

  onDidChangeTextDocument(): Disposable {
    return new Disposable();
  },

  onDidCloseTextDocument(): Disposable {
    return new Disposable();
  },

  createFileSystemWatcher(): {
    onDidChange: (listener: Function) => Disposable;
    onDidCreate: (listener: Function) => Disposable;
    onDidDelete: (listener: Function) => Disposable;
    dispose: () => void;
  } {
    return {
      onDidChange: () => new Disposable(),
      onDidCreate: () => new Disposable(),
      onDidDelete: () => new Disposable(),
      dispose: () => undefined,
    };
  },

  fs: {
    async readFile(): Promise<Buffer> {
      return Buffer.from('');
    },
    async writeFile(): Promise<void> {
      return;
    },
  },

  async applyEdit(_edit: WorkspaceEdit): Promise<boolean> {
    return true;
  },

  updateConfiguration(section: string, key: string, value: any): void {
    const config = new WorkspaceConfiguration(section);
    void config.update(key, value).then(() => fireConfigurationChange(section));
  },
};

const messageHandler = async <T>(_: string, ...items: T[]): Promise<T | undefined> => {
  return items.length > 0 ? items[0] : undefined;
};

const window = {
  showInformationMessage: messageHandler,
  showWarningMessage: messageHandler,
  showErrorMessage: messageHandler,
  showQuickPick: async () => undefined,
  showOpenDialog: async () => undefined,
  showSaveDialog: async () => undefined,
  showTextDocument: async () => undefined,
  createTextEditorDecorationType(options: any): TextEditorDecorationType {
    return new TextEditorDecorationType(options);
  },
  createOutputChannel(name: string): OutputChannel {
    return new OutputChannel(name);
  },
  onDidChangeVisibleTextEditors(): Disposable {
    return new Disposable();
  },
  onDidChangeActiveTextEditor(): Disposable {
    return new Disposable();
  },
  visibleTextEditors: [] as any[],
  activeTextEditor: null as any,
};

const languages = {
  registerHoverProvider(): Disposable {
    return new Disposable();
  },
};

const commands = {
  registerCommand(): Disposable {
    return new Disposable();
  },
  async executeCommand(): Promise<void> {
    return;
  },
};

const env = {
  async openExternal(): Promise<boolean> {
    return true;
  },
};

const extensions = {
  getExtension(): undefined {
    return undefined;
  },
  all: [] as any[],
};

const version = '1.104.0-mock';

const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3,
} as const;

const ExtensionMode = {
  Production: 1,
  Development: 2,
  Test: 3,
} as const;

const vscode = {
  window,
  workspace,
  languages,
  commands,
  env,
  extensions,
  version,
  Uri,
  Position,
  Range,
  Selection,
  MarkdownString,
  Hover,
  ThemeColor,
  TextEditorDecorationType,
  CancellationTokenSource,
  CancellationToken,
  WorkspaceEdit,
  Disposable,
  OverviewRulerLane,
  ConfigurationTarget,
  ExtensionMode,
};

export = vscode;
