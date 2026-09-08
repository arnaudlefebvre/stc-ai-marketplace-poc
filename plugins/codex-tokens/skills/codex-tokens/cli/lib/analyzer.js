const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Official Rate Card History
const PRICING_HISTORY = require('./pricings.json');

/**
 * Récupère les tarifs valides d'un modèle pour un jour donné (YYYY-MM-DD)
 */
function getRatesForModelAndDate(model, dayStr) {
    const history = PRICING_HISTORY[model];
    if (!history || !Array.isArray(history)) {
        return { input: 0, cached: 0, output: 0 };
    }
    
    // Recherche du tarif applicable à la date donnée (startDate <= dayStr <= endDate)
    const rate = history.find(entry => {
        const startOk = !entry.startDate || dayStr >= entry.startDate;
        const endOk = !entry.endDate || dayStr <= entry.endDate;
        return startOk && endOk;
    });
    
    return rate ? { input: rate.input, cached: rate.cached, output: rate.output } : { input: 0, cached: 0, output: 0 };
}

/**
 * Recursively scans directory to find all .jsonl files with their mtime
 */
function getJsonlFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getJsonlFiles(fullPath));
        } else if (file.endsWith('.jsonl')) {
            results.push({
                path: fullPath,
                name: file,
                mtimeMs: stat.mtimeMs
            });
        }
    });
    return results;
}

/**
 * Resolves day (YYYY-MM-DD) from file path or modification time
 */
function getFileDay(filePath, mtimeMs) {
    // Attempt to extract YYYY-MM-DD from folder structure (.../2026/MM/DD/rollout-...)
    const parts = filePath.split(path.sep);
    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === '2025' || parts[i] === '2026') {
            if (i + 2 < parts.length) {
                return `${parts[i]}-${parts[i+1]}-${parts[i+2]}`;
            }
        }
    }
    // Fallback to mtime
    const date = new Date(mtimeMs);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parses a single JSONL file line-by-line asynchronously
 */
async function processFile(filePath, mtimeMs) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let currentModel = "unknown";
    const dayStr = getFileDay(filePath, mtimeMs);

    let prevInput = 0;
    let prevCached = 0;
    let prevOutput = 0;
    let prevReasoning = 0;
    let prevTotal = 0;

    const deltas = [];

    for await (const line of rl) {
        try {
            if (!line.trim()) continue;
            const data = JSON.parse(line);
            const etype = data.type;
            const payload = data.payload || {};

            if (etype === 'turn_context') {
                const model = payload.model;
                if (model) {
                    currentModel = model;
                }
            } else if (etype === 'event_msg' && payload.type === 'token_count') {
                const info = payload.info || {};
                const totalUsage = info.total_token_usage || {};
                if (totalUsage && Object.keys(totalUsage).length > 0) {
                    const currInput = totalUsage.input_tokens || 0;
                    const currCached = totalUsage.cached_input_tokens || 0;
                    const currOutput = totalUsage.output_tokens || 0;
                    const currReasoning = totalUsage.reasoning_output_tokens || 0;
                    const currTotal = totalUsage.total_tokens || 0;

                    if (currTotal > prevTotal) {
                        const deltaInput = currInput - prevInput;
                        const deltaCached = currCached - prevCached;
                        const deltaOutput = currOutput - prevOutput;
                        const deltaReasoning = currReasoning - prevReasoning;
                        const deltaTotal = currTotal - prevTotal;

                        deltas.push({
                            model: currentModel,
                            day: dayStr,
                            input: deltaInput,
                            cached: deltaCached,
                            output: deltaOutput,
                            reasoning: deltaReasoning,
                            total: deltaTotal
                        });

                        prevInput = currInput;
                        prevCached = currCached;
                        prevOutput = currOutput;
                        prevReasoning = currReasoning;
                        prevTotal = currTotal;
                    }
                }
            }
        } catch (e) {
            // Ignore parse errors on bad lines
        }
    }

    return {
        filePath: filePath,
        fileName: path.basename(filePath),
        day: dayStr,
        model: currentModel,
        deltas: deltas
    };
}

/**
 * Core Analyzer and Output Generator
 */
async function runAnalysis(filesList, timeframeName, adminCosts = null) {
    if (filesList.length === 0) {
        console.log(`No session logs found for the timeframe: '${timeframeName}'.`);
        return;
    }

    console.log(`Analyzing ${filesList.length} session file(s) for ${timeframeName}...`);

    const modelStats = {};
    const dayStats = {};
    const fileStats = [];

    const initModel = () => ({ input: 0, cached: 0, output: 0, reasoning: 0, total: 0, turns: 0, credits: 0.0 });
    const initDay = () => ({ input: 0, cached: 0, output: 0, total: 0, credits_standard: 0.0 });

    for (const fileObj of filesList) {
        const fileResult = await processFile(fileObj.path, fileObj.mtimeMs);
        let fileCreditsStd = 0;
        let fileTokensTot = 0;
        let finalModel = fileResult.model;

        for (const d of fileResult.deltas) {
            const model = d.model;
            const day = d.day;

            if (!modelStats[model]) modelStats[model] = initModel();
            if (!dayStats[day]) dayStats[day] = initDay();

            modelStats[model].input += d.input;
            modelStats[model].cached += d.cached;
            modelStats[model].output += d.output;
            modelStats[model].reasoning += d.reasoning;
            modelStats[model].total += d.total;
            modelStats[model].turns += 1;

            const rates = getRatesForModelAndDate(model, day);
            const uncachedDelta = d.input - d.cached;
            const deltaCredits = (
                uncachedDelta * rates.input +
                d.cached * rates.cached +
                d.output * rates.output
            ) / 1000000.0;

            dayStats[day].input += d.input;
            dayStats[day].cached += d.cached;
            dayStats[day].output += d.output;
            dayStats[day].total += d.total;
            dayStats[day].credits_standard += deltaCredits;

            modelStats[model].credits += deltaCredits;

            fileCreditsStd += deltaCredits;
            fileTokensTot += d.total;
            finalModel = model;
        }

        if (fileTokensTot > 0) {
            fileStats.push({
                name: fileResult.fileName,
                day: fileResult.day,
                model: finalModel,
                tokens: fileTokensTot,
                credits_std: fileCreditsStd
            });
        }
    }

    // Print Report
    console.log("\n" + "=".repeat(90));
    console.log(`                      CODEX TOKEN & CREDIT USAGE REPORT`);
    console.log(`                      Timeframe: ${timeframeName.toUpperCase()}`);
    console.log("=".repeat(90));

    // 1. Global Summary
    let totalInput = 0;
    let totalCached = 0;
    let totalOutput = 0;
    let totalTokens = 0;
    let totalTurns = 0;

    for (const m in modelStats) {
        totalInput += modelStats[m].input;
        totalCached += modelStats[m].cached;
        totalOutput += modelStats[m].output;
        totalTokens += modelStats[m].total;
        totalTurns += modelStats[m].turns;
    }

    const cacheHitRate = totalInput > 0 ? (totalCached / totalInput * 100) : 0;

    console.log("\n[GLOBAL SUMMARY]");
    console.log(`  Sessions Analyzed   : ${filesList.length}`);
    console.log(`  Total LLM Calls     : ${totalTurns.toLocaleString()}`);
    console.log(`  Total Input Tokens  : ${totalInput.toLocaleString()}`);
    console.log(`  Total Cached Tokens : ${totalCached.toLocaleString()} (Cache Hit Rate: ${cacheHitRate.toFixed(2)}%)`);
    console.log(`  Total Output Tokens : ${totalOutput.toLocaleString()}`);
    console.log(`  Total Tokens        : ${totalTokens.toLocaleString()}`);

    // 2. Results by Model
    console.log("\n" + "-".repeat(90));
    console.log(`${'MODEL NAME'.padEnd(18)} | ${'TURNS'.padEnd(6)} | ${'INPUT TOKENS'.padEnd(14)} | ${'CACHED TOKENS'.padEnd(14)} | ${'OUTPUT TOKENS'.padEnd(12)} | ${'STD CREDITS'.padEnd(12)}`);
    console.log("-".repeat(90));

    let totalStdCredits = 0.0;
    const sortedModels = Object.keys(modelStats).sort();
    for (const model of sortedModels) {
        const s = modelStats[model];
        const credits = s.credits;
        totalStdCredits += credits;

        console.log(`${model.padEnd(18)} | ${s.turns.toString().padEnd(6)} | ${s.input.toLocaleString().padEnd(14)} | ${s.cached.toLocaleString().padEnd(14)} | ${s.output.toLocaleString().padEnd(12)} | ${credits.toFixed(2).padEnd(12)}`);
    }

    console.log("-".repeat(90));
    console.log(`${'TOTAL'.padEnd(18)} | ${totalTurns.toString().padEnd(6)} | ${totalInput.toLocaleString().padEnd(14)} | ${totalCached.toLocaleString().padEnd(14)} | ${totalOutput.toLocaleString().padEnd(12)} | ${totalStdCredits.toFixed(2).padEnd(12)}`);

    // 3. Fast Mode Analysis
    console.log("\n" + "-".repeat(90));
    console.log("[FAST MODE ANALYSIS - DYNAMIC DETECTION]");
    console.log("By default, the Rate Card assumes Standard billing tier (1.0x).");
    console.log("If you run tasks in 'Fast Mode', OpenAI applies a multiplier to the credits:");
    console.log("  - GPT-5.4 standard credits are multiplied by 2.0x");
    console.log("  - GPT-5.5 standard credits are multiplied by 2.5x");

    let totalAddedCredits = 0.0;

    if (adminCosts && Object.keys(adminCosts).length > 0) {
        console.log("\nChecking discrepancies for provided daily admin billing totals:");
        const sortedDays = Object.keys(adminCosts).sort();
        for (const day of sortedDays) {
            const targetBilling = adminCosts[day];
            const dayFiles = fileStats.filter(f => f.day === day);
            if (dayFiles.length === 0) continue;

            const dayStdSum = dayFiles.reduce((sum, f) => sum + f.credits_std, 0);
            const targetDiff = targetBilling - dayStdSum;

            if (Math.abs(targetDiff) > 0.5) {
                console.log(`\n[>] Detecting Fast Mode sessions for ${day}:`);
                console.log(`   Target billing: ${targetBilling.toFixed(2)} credits | Standard cost: ${dayStdSum.toFixed(2)} credits | Diff to explain: ${targetDiff > 0 ? '+' : ''}${targetDiff.toFixed(2)}`);

                // Subset-sum DP solver
                const roundedFiles = dayFiles.map((f, idx) => ({ idx, name: f.name, val: Math.round(f.credits_std * 10) / 10 }));
                const targetRounded = Math.round(targetDiff * 10) / 10;

                let dp = { 0.0: [] };
                for (const file of roundedFiles) {
                    const newDp = { ...dp };
                    for (const sStr in dp) {
                        const s = parseFloat(sStr);
                        const subset = dp[sStr];
                        const newSum = Math.round((s + file.val) * 10) / 10;
                        if (newSum <= targetRounded + 50) {
                            if (newDp[newSum] === undefined || newDp[newSum].length > subset.length + 1) {
                                newDp[newSum] = [...subset, file.idx];
                            }
                        }
                    }
                    dp = newDp;
                }

                let closestKey = null;
                let minDiff = Infinity;
                for (const sStr in dp) {
                    const s = parseFloat(sStr);
                    const diff = Math.abs(s - targetRounded);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestKey = s;
                    }
                }

                if (minDiff < 5.0 && closestKey !== null) {
                    const fastIndices = dp[closestKey];
                    console.log(`   Successfully identified ${fastIndices.length} session(s) as having Fast Mode active (2.0x):`);
                    for (const idx of fastIndices) {
                        const f = dayFiles[idx];
                        console.log(`     - ${f.name} (Standard: ${f.credits_std.toFixed(2)} -> Fast: ${(f.credits_std * 2).toFixed(2)})`);
                        totalAddedCredits += f.credits_std;
                    }
                } else {
                    console.log(`   [Error] Could not find a mathematically plausible combination of Fast Mode sessions to explain this difference.`);
                    console.log(`      (Closest match difference: ${minDiff.toFixed(2)} credits)`);
                }
            } else {
                console.log(`   - ${day}: Matches Standard tier perfectly (${dayStdSum.toFixed(2)} credits).`);
            }
        }
        const adjustedTotalCredits = totalStdCredits + totalAddedCredits;
        console.log(`\nAdjusted Total Credits (Standard + Detected Fast Mode) : ${adjustedTotalCredits.toFixed(2)} credits`);
    } else {
        console.log(`\nAdjusted Total Credits (Standard Billing Tier)         : ${totalStdCredits.toFixed(2)} credits`);
        console.log("(Provide daily admin billing values via --admin-costs to detect Fast mode sessions.)");
    }

    console.log("=".repeat(90));
}

/**
 * Computes simple totals (tokens and standard credits) for a list of files
 */
async function getTotalsForFiles(filesList) {
    let totalTokens = 0;
    let totalStdCredits = 0;

    for (const fileObj of filesList) {
        const fileResult = await processFile(fileObj.path, fileObj.mtimeMs);
        for (const d of fileResult.deltas) {
            totalTokens += d.total;
            const rates = getRatesForModelAndDate(d.model, d.day);
            const uncachedDelta = d.input - d.cached;
            const deltaCredits = (
                uncachedDelta * rates.input +
                d.cached * rates.cached +
                d.output * rates.output
            ) / 1000000.0;
            totalStdCredits += deltaCredits;
        }
    }

    return { tokens: totalTokens, credits: totalStdCredits };
}

module.exports = {
    getJsonlFiles,
    getFileDay,
    processFile,
    runAnalysis,
    getTotalsForFiles
};
