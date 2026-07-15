import * as path from 'path';

declare global {
    // eslint-disable-next-line no-var, @typescript-eslint/naming-convention
    var __vscodeMockRegistered: boolean | undefined;
}

function registerVscodeMock() {
    if (global.__vscodeMockRegistered) {
        return;
    }

    const moduleImpl = require('module') as any;
    const originalResolveFilename = moduleImpl._resolveFilename;
    const mockPath = path.resolve(__dirname, '__mocks__/vscode.js');

    moduleImpl._resolveFilename = function (
        request: string,
        parent: NodeModule,
        isMain: boolean,
        options: unknown,
    ) {
        if (request === 'vscode') {
            return mockPath;
        }

        return originalResolveFilename.call(this, request, parent, isMain, options);
    };

    global.__vscodeMockRegistered = true;
}

async function main() {
    try {
        registerVscodeMock();

        const { run } = require('./suite/index') as { run: () => Promise<void> };
        await run();
    } catch (err) {
        console.error('Failed to run tests');
        console.error(err);
        process.exit(1);
    }
}

void main();
