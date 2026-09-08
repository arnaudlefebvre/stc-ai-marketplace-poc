#!/usr/bin/env node
/**
 * Codex Tokens CLI - Executable Entrypoint
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getJsonlFiles, getFileDay, processFile, runAnalysis, getTotalsForFiles } = require('../lib/analyzer');

// Default Sessions Directory
const DEFAULT_SESSIONS_DIR = path.join(os.homedir(), '.codex', 'sessions');

/**
 * Format Date as YYYY-MM-DD in local time
 */
function formatDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Main command router
 */
async function main() {
    const args = process.argv.slice(2);
    
    // Commands: help, current, week, month, year, range
    let command = "current"; // Default command is "current"
    let commandArgs = [];
    let adminCostsArg = null;
    let sessionsDir = DEFAULT_SESSIONS_DIR;
    let hookMode = false;
    let hookEventName = null;
    let cliBriefMode = false;

    // Command parser
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--hook' || arg === '--json') {
            hookMode = true;
            if (i + 1 < args.length && !args[i+1].startsWith('-')) {
                hookEventName = args[i+1];
                i++;
            }
        } else if (arg === '--cli') {
            cliBriefMode = true;
        } else if (arg === '-a' || arg === '--admin-costs') {
            adminCostsArg = args[++i];
        } else if (arg === '-h' || arg === '--help' || arg === 'help') {
            command = "help";
        } else if (['current', 'week', 'month', 'year', 'range'].includes(arg)) {
            command = arg;
        } else if (!arg.startsWith('-')) {
            // If it's a positional argument and not a command, it's a command argument
            commandArgs.push(arg);
        }
    }

    if (command === "help") {
        printHelp();
        return;
    }

    if (hookMode || cliBriefMode) {
        // Find session files
        if (!fs.existsSync(sessionsDir)) {
            console.error(`Error: Codex sessions directory '${sessionsDir}' does not exist.`);
            process.exit(1);
        }
        const allFiles = getJsonlFiles(sessionsDir);
        if (allFiles.length === 0) {
            if (cliBriefMode) {
                console.log("Aucune session Codex trouvée.");
            } else {
                console.log(JSON.stringify({
                    continue: true,
                    suppressOutput: false,
                    systemMessage: "Aucune session Codex trouvée."
                }, null, 2));
            }
            return;
        }

        // 1. Session: find the current or last active session
        allFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
        let sessionToAnalyze = allFiles[0];
        const checkResult = await processFile(sessionToAnalyze.path, sessionToAnalyze.mtimeMs);
        if (checkResult.deltas.length === 0 && allFiles.length > 1) {
            for (let i = 1; i < allFiles.length; i++) {
                const testResult = await processFile(allFiles[i].path, allFiles[i].mtimeMs);
                if (testResult.deltas.length > 0) {
                    sessionToAnalyze = allFiles[i];
                    break;
                }
            }
        }
        const sessionStats = await getTotalsForFiles([sessionToAnalyze]);
        
        let message = "";
        if (hookEventName === "Stop") {
            // For Stop event, display ONLY current session statistics to keep it fast and uncluttered
            message = `Consommation session : ${sessionStats.tokens.toLocaleString()} tokens, ${sessionStats.credits.toFixed(2)} crédits. Utilisez la commande codex-tokens dans votre terminal ou le skill $codex-tokens pour plus d'infos.`;
        } else {
            // 2. Week: filter and get totals
            const today = new Date();
            const todayStr = formatDate(today);
            const dayOfWeek = today.getDay();
            const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const monday = new Date(today);
            monday.setDate(today.getDate() - diffToMonday);
            const startOfWeek = formatDate(monday);
            const weekFiles = allFiles.filter(f => {
                const fileDay = getFileDay(f.path, f.mtimeMs);
                return fileDay >= startOfWeek && fileDay <= todayStr;
            });
            const weekStats = await getTotalsForFiles(weekFiles);

            // 3. Month: filter and get totals
            const startOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            const monthFiles = allFiles.filter(f => {
                const fileDay = getFileDay(f.path, f.mtimeMs);
                return fileDay >= startOfMonth && fileDay <= todayStr;
            });
            const monthStats = await getTotalsForFiles(monthFiles);

            // Formulate the beautiful, clean single line message!
            message = `session : ${sessionStats.tokens.toLocaleString()} tokens, ${sessionStats.credits.toFixed(2)} crédits | cette semaine : ${weekStats.tokens.toLocaleString()} tokens, ${weekStats.credits.toFixed(2)} crédits | ce mois-ci : ${monthStats.tokens.toLocaleString()} tokens, ${monthStats.credits.toFixed(2)} crédits. Utilisez la commande codex-tokens dans votre terminal ou le skill $codex-tokens pour plus d'infos.`;
        }

        if (cliBriefMode) {
            console.log(message);
        } else {
            const hookOutput = {
                continue: true,
                suppressOutput: false,
                systemMessage: message
            };

            if (hookEventName === "SessionStart") {
                hookOutput.hookSpecificOutput = {
                    hookEventName: "SessionStart",
                    additionalContext: `Codex tokens usage brief summary displayed to user.`
                };
            }

            console.log(JSON.stringify(hookOutput, null, 2));
        }
        return;
    }

    // Intercept console.log if in hookMode
    const logBuffer = [];
    const originalConsoleLog = console.log;
    if (hookMode) {
        console.log = (...logArgs) => {
            const line = logArgs.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
            logBuffer.push(line);
        };
    }

    try {
        // Load admin costs
        let adminCosts = {};
        if (adminCostsArg) {
            if (fs.existsSync(adminCostsArg)) {
                try {
                    const fileContent = fs.readFileSync(adminCostsArg, 'utf8');
                    adminCosts = JSON.parse(fileContent);
                    console.log(`Loaded admin billing totals from JSON file: '${adminCostsArg}'`);
                } catch (err) {
                    console.error(`Error reading JSON file ${adminCostsArg}: ${err.message}`);
                    process.exit(1);
                }
            } else {
                try {
                    const pairs = adminCostsArg.split(',');
                    for (const pair of pairs) {
                        const [d, c] = pair.split(':');
                        if (d && c) {
                            adminCosts[d.trim()] = parseFloat(c.trim());
                        }
                    }
                } catch (err) {
                    console.error(`Error parsing --admin-costs string '${adminCostsArg}'. Format must be YYYY-MM-DD:credits. Error: ${err.message}`);
                    process.exit(1);
                }
            }
        } else {
            // Look for default admin_costs.json in current directory or project root
            if (fs.existsSync("admin_costs.json")) {
                try {
                    const fileContent = fs.readFileSync("admin_costs.json", 'utf8');
                    adminCosts = JSON.parse(fileContent);
                    console.log("Loaded admin billing totals from local 'admin_costs.json' file.");
                } catch (err) {}
            } else {
                // Out of the box fallback for June 3rd
                adminCosts = { "2026-06-03": 3233.80 };
            }
        }

        // Scan for all files
        if (!fs.existsSync(sessionsDir)) {
            console.error(`Error: Codex sessions directory '${sessionsDir}' does not exist.`);
            process.exit(1);
        }
        const allFiles = getJsonlFiles(sessionsDir);

        if (allFiles.length === 0) {
            console.log(`No session logs found in '${sessionsDir}'.`);
            return;
        }

        // Dispatch commands
        const today = new Date();
        const todayStr = formatDate(today);

        switch (command) {
            case 'current': {
                // Sort by mtimeMs descending to find the current active session log
                allFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
                let sessionToAnalyze = allFiles[0];
                
                // If the current session is empty (just launched or /new), fall back to the most recent active session
                const checkResult = await processFile(sessionToAnalyze.path, sessionToAnalyze.mtimeMs);
                if (checkResult.deltas.length === 0 && allFiles.length > 1) {
                    for (let i = 1; i < allFiles.length; i++) {
                        const testResult = await processFile(allFiles[i].path, allFiles[i].mtimeMs);
                        if (testResult.deltas.length > 0) {
                            sessionToAnalyze = allFiles[i];
                            break;
                        }
                    }
                }
                
                await runAnalysis([sessionToAnalyze], `Active Session (${sessionToAnalyze.name})`, adminCosts);
                break;
            }

            case 'week': {
                // Find Monday of the current week
                const dayOfWeek = today.getDay();
                const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                const monday = new Date(today);
                monday.setDate(today.getDate() - diffToMonday);
                const startOfWeek = formatDate(monday);
                
                const filtered = allFiles.filter(f => {
                    const fileDay = getFileDay(f.path, f.mtimeMs);
                    return fileDay >= startOfWeek && fileDay <= todayStr;
                });
                await runAnalysis(filtered, `Current Week (${startOfWeek} to ${todayStr})`, adminCosts);
                break;
            }

            case 'month': {
                const startOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
                const filtered = allFiles.filter(f => {
                    const fileDay = getFileDay(f.path, f.mtimeMs);
                    return fileDay >= startOfMonth && fileDay <= todayStr;
                });
                await runAnalysis(filtered, `Current Month (${startOfMonth} to ${todayStr})`, adminCosts);
                break;
            }

            case 'year': {
                const startOfYear = `${today.getFullYear()}-01-01`;
                const filtered = allFiles.filter(f => {
                    const fileDay = getFileDay(f.path, f.mtimeMs);
                    return fileDay >= startOfYear && fileDay <= todayStr;
                });
                await runAnalysis(filtered, `Current Year (${startOfYear} to ${todayStr})`, adminCosts);
                break;
            }

            case 'range': {
                let start = commandArgs[0];
                let end = commandArgs[1];

                if (!start || !end) {
                    console.error("Error: 'range' command requires <start_date> and <end_date> arguments in YYYY-MM-DD format.");
                    console.log("Usage: codex-tokens range YYYY-MM-DD YYYY-MM-DD");
                    process.exit(1);
                }

                const filtered = allFiles.filter(f => {
                    const fileDay = getFileDay(f.path, f.mtimeMs);
                    return fileDay >= start && fileDay <= end;
                });
                await runAnalysis(filtered, `Custom Range (${start} to ${end})`, adminCosts);
                break;
            }

            default:
                printHelp();
                break;
        }
    } finally {
        if (hookMode) {
            console.log = originalConsoleLog;
            const reportText = logBuffer.join('\n');
            const hookOutput = {
                continue: true,
                suppressOutput: false,
                systemMessage: reportText
            };
            if (hookEventName === "SessionStart") {
                hookOutput.hookSpecificOutput = {
                    hookEventName: "SessionStart",
                    additionalContext: `Codex tokens usage analyzed automatically for ${command}.`
                };
            }
            console.log(JSON.stringify(hookOutput, null, 2));
        }
    }
}

function printHelp() {
    console.log(`
Codex Tokens CLI - Tool usage guide
===================================
A CLI tool to analyze your real-time token & credit consumption in Codex sessions.

Available Commands:
  codex-tokens                   Analyzes and reports on your current active session.
  codex-tokens current           Same as above.
  codex-tokens week              Analyzes and aggregates usage for the current week (Mon-Sun).
  codex-tokens month             Analyzes and aggregates usage for the current month.
  codex-tokens year              Analyzes and aggregates usage for the current year.
  codex-tokens range <S> <E>     Analyzes usage between Start date <S> and End date <E> (YYYY-MM-DD).

Options:
  -a, --admin-costs <arg>        Provide real daily OpenAI Admin credit costs to detect Fast Mode.
                                 Can be a comma-separated list 'YYYY-MM-DD:credits,YYYY-MM-DD:credits'
                                 or a path to a JSON configuration file.
  --cli                          Display only a brief, single-line summary of session, week, and month statistics.
  -h, --help                     Display this help manual.

Examples:
  codex-tokens
  codex-tokens week
  codex-tokens month -a "2026-06-03:3233.80"
  codex-tokens range 2026-06-01 2026-06-15 --admin-costs admin_costs.json
`);
}

main().catch(err => {
    console.error("Unhandled CLI Error:", err);
    process.exit(1);
});
