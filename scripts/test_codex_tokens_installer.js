const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const installer = path.join(root, 'plugins', 'codex-tokens', 'skills', 'codex-tokens', 'scripts', 'install.js');
const cliPackage = path.join(root, 'plugins', 'codex-tokens', 'skills', 'codex-tokens', 'cli', 'package.json');
const pluginManifest = path.join(root, 'plugins', 'codex-tokens', '.codex-plugin', 'plugin.json');

const cli = JSON.parse(fs.readFileSync(cliPackage, 'utf8'));
const plugin = JSON.parse(fs.readFileSync(pluginManifest, 'utf8'));
const source = fs.readFileSync(installer, 'utf8');
assert.strictEqual(plugin.version.split('+')[0], '0.1.3');
assert.strictEqual(cli.version, '1.0.0');
assert(source.includes("process.platform === 'win32' ? 'npm.cmd' : 'npm'"));
assert(source.includes("shell: process.platform === 'win32'"));
assert(source.includes("runNpm(['--version']"));
assert(source.includes('npm was not found on PATH'));
assert(source.includes('execution permissions'));
assert(source.includes("uninstall', '--global'"));
assert(source.includes("['pack', cliDir"));
assert(source.includes("['install', '--global', archivePath]"));
assert(source.includes('finally'));
assert(!source.includes("npm install -g ."));
console.log('OK: installer uninstall, pack, archive install, and cleanup contract checks');
