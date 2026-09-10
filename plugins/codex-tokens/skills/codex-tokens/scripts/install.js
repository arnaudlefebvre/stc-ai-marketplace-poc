const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const cliDir = path.join(__dirname, '..', 'cli');
const packageJsonPath = path.join(cliDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const packageName = packageJson.name;
const cliVersion = packageJson.version;
const pluginRoot = path.join(__dirname, '..', '..', '..');
const pluginManifestPath = path.join(pluginRoot, '.codex-plugin', 'plugin.json');
const pluginVersion = JSON.parse(fs.readFileSync(pluginManifestPath, 'utf8')).version;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runNpm(args, options = {}) {
    try {
        return cp.execFileSync(npmCommand, args, {
            cwd: options.cwd,
            encoding: 'utf8',
            shell: process.platform === 'win32',
            stdio: options.captureOutput ? ['ignore', 'pipe', 'inherit'] : 'inherit'
        });
    } catch (err) {
        const details = [`command '${npmCommand}'`, `code ${err.code || 'unknown'}`];
        if (err.code === 'ENOENT') {
            details.push('npm was not found on PATH');
        } else if (err.code === 'EPERM') {
            details.push('the operating system denied starting npm; verify PATH, Node installation, and execution permissions');
        }
        const wrapped = new Error(`Failed to execute ${details.join('; ')}`);
        wrapped.cause = err;
        throw wrapped;
    }
}

function getGlobalRoot() {
    return runNpm(['root', '-g'], { captureOutput: true }).trim();
}

function removePreviousInstallation(globalRoot) {
    const packagePath = path.join(globalRoot, packageName);
    const binRoot = path.dirname(globalRoot);
    const launchers = ['codex-tokens', 'codex-tokens.cmd', 'codex-tokens.ps1']
        .map((name) => path.join(binRoot, name));
    const packagePresent = fs.existsSync(packagePath);
    const launcherPresent = launchers.some((launcher) => fs.existsSync(launcher));

    if (!packagePresent && !launcherPresent) {
        return false;
    }

    if (packagePresent) {
        runNpm(['uninstall', '--global', packageName]);
    }

    for (const launcher of launchers) {
        if (!fs.existsSync(launcher)) {
            continue;
        }
        const content = fs.readFileSync(launcher, 'utf8');
        if (content.includes(packageName)) {
            fs.unlinkSync(launcher);
        }
    }
    return true;
}

let temporaryDirectory;
let previousInstallationRemoved = false;

try {
    const npmVersion = runNpm(['--version'], { captureOutput: true }).trim();
    if (!npmVersion) {
        throw new Error(`npm command '${npmCommand}' returned no version`);
    }
    const globalRoot = getGlobalRoot();
    previousInstallationRemoved = removePreviousInstallation(globalRoot);
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-tokens-install-'));

    const packedName = runNpm(['pack', cliDir, '--pack-destination', temporaryDirectory, '--silent'], {
        captureOutput: true
    }).trim().split(/\r?\n/).pop();
    const archivePath = path.join(temporaryDirectory, packedName);
    if (!fs.existsSync(archivePath)) {
        throw new Error(`npm pack did not produce the expected archive: ${archivePath}`);
    }

    console.log(`Previous global installation removed: ${previousInstallationRemoved ? 'yes' : 'no'}`);
    console.log(`Plugin version: ${pluginVersion}`);
    console.log(`CLI package version: ${cliVersion}`);
    runNpm(['install', '--global', archivePath]);
    console.log('Global installation completed');
} catch (err) {
    console.error('Error: Failed to install codex-tokens globally:', err.message);
    process.exitCode = 1;
} finally {
    if (temporaryDirectory) {
        fs.rmSync(temporaryDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
}
