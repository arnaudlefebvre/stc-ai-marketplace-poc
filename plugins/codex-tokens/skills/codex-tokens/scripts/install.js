const cp = require('child_process');
const path = require('path');

const cliDir = path.join(__dirname, '..', 'cli');
console.log(`Installing codex-tokens-cli globally from: '${cliDir}'...`);

try {
    cp.execSync('npm install -g .', { cwd: cliDir, stdio: 'inherit' });
    console.log('Success: codex-tokens was installed globally and is ready for use!');
} catch (err) {
    console.error('Error: Failed to install codex-tokens globally:', err.message);
    process.exit(1);
}
