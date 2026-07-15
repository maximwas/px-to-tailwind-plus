import { execFile } from "node:child_process";
import { extractSpacingFromTheme } from "./parse";

const CHILD_TIMEOUT_MS = 3000;

/**
 * Reads `theme.spacing` from a Tailwind config by requiring it in an isolated
 * child Node process, so no untrusted config code runs in the extension host.
 * Only `.js`/`.cjs` are supported here; other formats use the regex fallback.
 * Resolves to null when the child cannot produce a usable result.
 */
export function readConfigViaChildProcess(
  configPath: string,
): Promise<Record<string, number> | null> {
  const script = `
    try {
      const mod = require(process.argv[1]);
      const config = mod && mod.default ? mod.default : mod;
      const theme = (config && config.theme) || {};
      process.stdout.write(JSON.stringify({
        spacing: theme.spacing,
        extendSpacing: theme.extend && theme.extend.spacing,
      }));
    } catch (error) {
      process.exit(2);
    }
  `;

  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ["-e", script, configPath],
      { timeout: CHILD_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error || !stdout) {
          resolve(null);
          return;
        }
        try {
          const parsed = JSON.parse(stdout) as {
            spacing?: unknown;
            extendSpacing?: unknown;
          };
          const spacing = extractSpacingFromTheme({
            spacing: parsed.spacing,
            extend: { spacing: parsed.extendSpacing },
          });
          resolve(spacing);
        } catch {
          resolve(null);
        }
      },
    );
  });
}
