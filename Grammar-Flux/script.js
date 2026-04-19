/**
 * CFG Sanitizer & Simplifier Logic
 * Author: Antigravity Simulator
 */

class Logger {
    constructor() {
        this.onLog = null;
    }
    log(msg, type = '') {
        if (this.onLog) this.onLog(msg, type);
    }
    system(msg) { this.log(msg, 'system'); }
    removed(msg) { this.log(msg, 'removed'); }
    highlight(msg) { this.log(msg, 'highlight'); }
}

const sysLogger = new Logger();

class Grammar {
    constructor(startSymbol, rules) {
        this.startSymbol = startSymbol || 'S';
        this.rules = new Map();
        for (let [lhs, rhsSet] of Object.entries(rules)) {
            let setVals = rhsSet instanceof Set ? rhsSet : new Set(rhsSet);
            this.rules.set(lhs, setVals);
        }
    }

    isVariable(sym) { return /^[A-Z]$/.test(sym); }
    isTerminal(sym) { return !this.isVariable(sym) && sym !== 'ε' && sym !== 'e'; }

    clone() {
        const newRules = {};
        for(let [lhs, rhsSet] of this.rules.entries()) {
            newRules[lhs] = new Set(rhsSet);
        }
        return new Grammar(this.startSymbol, newRules);
    }

    // Phase 1: Null Production Elimination
    eliminateNulls() {
        sysLogger.system("--- PHASE 1: Eliminate Null (ε) Productions ---");
        const nullable = new Set();
        let changed = true;

        // Step 1.1: Identify all nullable variables
        while(changed) {
            changed = false;
            for (let [lhs, rhsSet] of this.rules.entries()) {
                if (nullable.has(lhs)) continue;
                for (let rhs of rhsSet) {
                    if (rhs === 'ε' || rhs === 'e') {
                        nullable.add(lhs);
                        sysLogger.highlight(`Identified Nullable Variable: ${lhs} (Directly produces ε)`);
                        changed = true;
                        break;
                    }
                    let allNullable = true;
                    // If rhs has only variables and all are nullable, lhs is nullable
                    for (let char of rhs) {
                        if (!this.isVariable(char) || !nullable.has(char)) {
                            allNullable = false;
                            break;
                        }
                    }
                    if (rhs.length > 0 && allNullable) {
                        nullable.add(lhs);
                        sysLogger.highlight(`Identified Nullable Variable: ${lhs} (Produces strictly nullable string: ${rhs})`);
                        changed = true;
                        break;
                    }
                }
            }
        }

        if (nullable.size === 0) {
            sysLogger.system("No null productions found. Grammar unchanged.");
            return this.clone();
        }

        sysLogger.log(`Nullable Variables Power Set Domain: {${Array.from(nullable).join(', ')}}`);

        // Get power string combinations recursively
        const getCombinations = (str, nullableSet) => {
            if (str === 'ε' || str === 'e') return [];
            const results = [];
            const helper = (currentStr, index) => {
                if (index === str.length) {
                    results.push(currentStr === '' ? 'ε' : currentStr);
                    return;
                }
                const char = str[index];
                if (nullableSet.has(char)) {
                    helper(currentStr + char, index + 1); // keep
                    helper(currentStr, index + 1);        // drop
                } else {
                    helper(currentStr + char, index + 1);
                }
            }
            helper('', 0);
            return results;
        };

        const newRules = new Map();
        for (let [lhs, rhsSet] of this.rules.entries()) {
            newRules.set(lhs, new Set());
            for (let rhs of rhsSet) {
                if (rhs === 'ε' || rhs === 'e') {
                    sysLogger.removed(`Removing explicit null production: ${lhs} -> ε`);
                    continue; 
                }
                const combos = getCombinations(rhs, nullable);
                for (let combo of combos) {
                    if (combo !== 'ε' && combo !== 'e') {
                        if (!newRules.get(lhs).has(combo)) {
                            newRules.get(lhs).add(combo);
                        }
                    }
                }
                if (combos.length > 1) {
                    sysLogger.log(`Substituted subsets for ${lhs} -> ${rhs} (Added ${combos.filter(c => c!=='ε').join(', ')})`);
                }
            }
        }
        
        let finalRules = newRules;
        let newStart = this.startSymbol;
        if (nullable.has(this.startSymbol)) {
            sysLogger.highlight(`Start Symbol ${this.startSymbol} is nullable. Creating new Start Symbol S0.`);
            newStart = 'S0';
            finalRules = new Map();
            finalRules.set('S0', new Set([this.startSymbol, 'ε']));
            for (let [k, v] of newRules.entries()) {
                finalRules.set(k, v);
            }
        }

        let newG = new Grammar(newStart, {});
        newG.rules = finalRules;
        sysLogger.system("Phase 1 Complete.");
        return newG;
    }

    // Phase 2: Unit Production Elimination
    eliminateUnits() {
        sysLogger.system("--- PHASE 2: Eliminate Unit Productions ---");
        const newRules = new Map();
        for (let lhs of this.rules.keys()) {
            newRules.set(lhs, new Set());
        }

        // Step 2.1: Find Unit Pairs
        const pairs = new Map(); 
        for (let A of this.rules.keys()) {
            pairs.set(A, new Set([A]));
            let queue = [A];
            while(queue.length > 0) {
                let current = queue.shift();
                for (let rhs of this.rules.get(current) || []) {
                    if (rhs.length === 1 && this.isVariable(rhs[0])) {
                        if (!pairs.get(A).has(rhs)) {
                            pairs.get(A).add(rhs);
                            queue.push(rhs);
                            sysLogger.highlight(`Identified Unit Path: ${A} =>* ${rhs}`);
                        }
                    }
                }
            }
        }

        // Step 2.2: Substitute rules
        let removedUnitsCount = 0;
        let addedNonUnitsCount = 0;
        
        for (let [A, reachable] of pairs.entries()) {
            for (let B of reachable) {
                for (let rhs of this.rules.get(B) || []) {
                    // Check if it's a unit rule. If so, drop it from the final additions.
                    if (rhs.length === 1 && this.isVariable(rhs[0])) {
                        removedUnitsCount++;
                    } else {
                        if (!newRules.get(A).has(rhs)) {
                            newRules.get(A).add(rhs);
                            if (A !== B) {
                                addedNonUnitsCount++;
                                sysLogger.log(`Substituted: ${A} -> ${rhs} (inherited via ${B})`);
                            }
                        }
                    }
                }
            }
        }

        if (removedUnitsCount === 0 && addedNonUnitsCount === 0) {
            sysLogger.system("No Unit Productions detected.");
        } else {
            sysLogger.removed(`Cleared all A -> B chains.`);
        }

        let newG = new Grammar(this.startSymbol, {});
        newG.rules = newRules;
        sysLogger.system("Phase 2 Complete.");
        return newG;
    }

    // Phase 3: Useless Symbol Elimination
    eliminateUseless() {
        sysLogger.system("--- PHASE 3: Eliminate Useless Symbols ---");
        
        // Pass 1: Eliminating Non-Generating
        sysLogger.system("Pass 1: Identifying Generating Variables...");
        let generating = new Set();
        let changed = true;
        
        while(changed) {
            changed = false;
            for (let [lhs, rhsSet] of this.rules.entries()) {
                if (generating.has(lhs)) continue;
                for (let rhs of rhsSet) {
                    let isGenerating = true;
                    for (let char of rhs) {
                        if (this.isVariable(char) && !generating.has(char)) {
                            isGenerating = false;
                            break;
                        }
                    }
                    if (isGenerating) {
                        generating.add(lhs);
                        sysLogger.log(`Marked as Generating: ${lhs}`);
                        changed = true;
                        break;
                    }
                }
            }
        }

        sysLogger.log(`List of Generating Symbols found: {${Array.from(generating).join(', ')}}`);

        let tempRules = new Map();
        for (let [lhs, rhsSet] of this.rules.entries()) {
            if (!generating.has(lhs)) {
                sysLogger.removed(`Removing non-generating variable: ${lhs}`);
                continue;
            }
            let validSet = new Set();
            for (let rhs of rhsSet) {
                let validRule = true;
                for (let char of rhs) {
                    if (this.isVariable(char) && !generating.has(char)) {
                        validRule = false;
                        sysLogger.removed(`Removing rule ${lhs} -> ${rhs} (contains non-generating '${char}')`);
                        break;
                    }
                }
                if (validRule) validSet.add(rhs);
            }
            // Purge completely if empty, unless it's S0 generating exactly ε
            if (validSet.size > 0 || (lhs === this.startSymbol && validSet.has('ε'))) {
                tempRules.set(lhs, validSet);
            } else {
                sysLogger.removed(`Purging variable completely (no valid rules): ${lhs}`);
            }
        }

        // Pass 2: Eliminating Non-Reachable
        sysLogger.system("Pass 2: Identifying Reachable Variables from Start...");
        let reachable = new Set([this.startSymbol]);
        let queue = [this.startSymbol];

        let startRules = tempRules.get(this.startSymbol) || new Set();
        if (startRules.size === 0 && !generating.has(this.startSymbol)) {
             sysLogger.removed(`Start symbol ${this.startSymbol} is non-generating! Grammar reduces to Empty Language.`);
             return new Grammar(this.startSymbol, {});
        }

        while(queue.length > 0) {
            let A = queue.shift();
            for (let rhs of tempRules.get(A) || []) {
                for (let char of rhs) {
                    if (this.isVariable(char) && !reachable.has(char)) {
                        reachable.add(char);
                        sysLogger.log(`Marked as Reachable: ${char} (from ${A})`);
                        queue.push(char);
                    }
                }
            }
        }

        sysLogger.log(`List of Reachable Symbols found: {${Array.from(reachable).join(', ')}}`);

        let finalRules = new Map();
        for (let [lhs, rhsSet] of tempRules.entries()) {
            if (reachable.has(lhs)) {
                finalRules.set(lhs, rhsSet);
            } else {
                sysLogger.removed(`Removing non-reachable variable: ${lhs}`);
            }
        }

        let newG = new Grammar(this.startSymbol, {});
        newG.rules = finalRules;
        sysLogger.system("Phase 3 Complete. Grammar is fully reduced.");
        return newG;
    }
}

// ---------------- UI Integration ----------------

let currentGrammarObj = null;
let originalGrammarObj = null;

function parseInputText(text) {
    const rulesObj = {};
    let startSymbolLocal = null;
    const lines = text.split('\n');
    let hasValidParse = false;

    for (let line of lines) {
        line = line.split('//')[0].trim();
        if (!line) continue;
        
        const parts = line.split(/\s*(?:->|=|→)\s*/);
        if (parts.length !== 2) {
            sysLogger.removed(`Parser ignored invalid line: ${line}`);
            continue;
        }
        
        const lhs = parts[0].trim();
        if (lhs.length !== 1 || !/^[A-Z]$/.test(lhs)) {
            sysLogger.removed(`Parser warning: LHS "${lhs}" is not single uppercase A-Z. Ignored.`);
            continue;
        }

        const rhsList = parts[1].split('|').map(r => r.trim());
        if (!rulesObj[lhs]) rulesObj[lhs] = new Set();
        
        for (let r of rhsList) {
            rulesObj[lhs].add(r === '' ? 'ε' : r);
        }
        
        if (!startSymbolLocal) startSymbolLocal = lhs;
        hasValidParse = true;
    }
    
    if (!hasValidParse) return null;
    return new Grammar(startSymbolLocal, rulesObj);
}

function renderDOMGrammar(g, elementId, prevG = null) {
    const el = document.getElementById(elementId);
    if (!g || g.rules.size === 0) {
        el.innerHTML = '<div class="placeholder">Empty Grammar ($\emptyset$). Language produces nothing.</div>';
        return;
    }

    let html = '';
    for (let [lhs, rhsSet] of g.rules.entries()) {
        const isEmptyRule = (rhsSet.size === 0);
        if (isEmptyRule && lhs !== g.startSymbol) continue; // Skip entirely empty except start
        
        html += `<div class="rule-line anim-add">
            <div class="rule-lhs">${lhs}</div>
            <div class="rule-arrow">&rarr;</div>
            <div class="rule-rhs">`;
        
        let rhsArray = Array.from(rhsSet);
        if (isEmptyRule) {
            html += `<span class="rule-term eps">∅</span>`;
        } else {
            rhsArray.forEach((rhs, index) => {
                let termHtml = '';
                if (rhs === 'ε' || rhs === 'e') {
                    termHtml = `<span class="term-char eps">ε</span>`;
                } else {
                    for (let char of rhs) {
                        const isVar = g.isVariable(char);
                        termHtml += `<span class="term-char ${isVar ? 'variable' : 'terminal'}">${char}</span>`;
                    }
                }
                html += `<span class="rule-term">${termHtml}</span>`;
                if (index < rhsArray.length - 1) {
                    html += `<span class="rule-separator">|</span>`;
                }
            });
        }
        html += `</div></div>`;
    }
    el.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => {
    const btnParse = document.getElementById("btn-parse");
    const btnNulls = document.getElementById("btn-nulls");
    const btnUnits = document.getElementById("btn-units");
    const btnUseless = document.getElementById("btn-useless");
    const btnReset = document.getElementById("btn-reset");
    const btnLoadExample = document.getElementById("btn-load-example");
    const btnInsertArrow = document.getElementById("btn-insert-arrow");
    const btnInsertEps = document.getElementById("btn-insert-eps");
    const toggleSequence = document.getElementById("toggle-sequence");
    const inputArea = document.getElementById("grammar-input");
    const traceLog = document.getElementById("trace-log");
    const themeToggleBtn = document.getElementById("theme-toggle");
    
    // Theme logic
    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'light') {
            document.documentElement.removeAttribute('data-theme');
            themeToggleBtn.textContent = '☀️';
            themeToggleBtn.title = 'Switch to Light Mode';
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            themeToggleBtn.textContent = '🌙';
            themeToggleBtn.title = 'Switch to Dark Mode';
        }
    });
    
    sysLogger.onLog = (msg, type) => {
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;
        div.textContent = msg;
        traceLog.appendChild(div);
        traceLog.scrollTop = traceLog.scrollHeight;
    };

    btnInsertArrow.addEventListener('click', () => {
        const start = inputArea.selectionStart;
        const end = inputArea.selectionEnd;
        const val = inputArea.value;
        inputArea.value = val.substring(0, start) + '→ ' + val.substring(end);
        inputArea.selectionStart = inputArea.selectionEnd = start + 2;
        inputArea.focus();
    });

    btnInsertEps.addEventListener('click', () => {
        const start = inputArea.selectionStart;
        const end = inputArea.selectionEnd;
        const val = inputArea.value;
        inputArea.value = val.substring(0, start) + 'ε' + val.substring(end);
        inputArea.selectionStart = inputArea.selectionEnd = start + 1;
        inputArea.focus();
    });

    btnLoadExample.addEventListener('click', () => {
        inputArea.value = "S -> aA | bB | C\nA -> a\nB -> A\nC -> ε\nD -> d";
        inputArea.classList.add('anim-highlight');
        setTimeout(() => inputArea.classList.remove('anim-highlight'), 1000);
    });

    btnParse.addEventListener('click', () => {
        traceLog.innerHTML = '';
        currentGrammarObj = parseInputText(inputArea.value);
        if (currentGrammarObj) {
            originalGrammarObj = currentGrammarObj.clone();
            renderDOMGrammar(currentGrammarObj, 'parsed-grammar');
            renderDOMGrammar(currentGrammarObj, 'output-grammar');
            sysLogger.system("Grammar explicitly initialized in memory.");
            
            btnNulls.disabled = false;
            btnUnits.disabled = false;
            btnUseless.disabled = false;
            btnReset.disabled = false;
            
            btnNulls.classList.remove('active-step');
            btnUnits.classList.remove('active-step');
            btnUseless.classList.remove('active-step');
        } else {
            sysLogger.removed("CRITICAL: Failed to parse grammar. Provide valid CFG.");
        }
    });

    btnNulls.addEventListener('click', () => {
        if (!originalGrammarObj) return;
        const isSeq = toggleSequence.checked;
        
        let oldG;
        if (isSeq) {
            sysLogger.system("--- SEQUENCE STEP 1 ---");
            oldG = originalGrammarObj.clone();
            currentGrammarObj = originalGrammarObj.clone().eliminateNulls();
        } else {
            oldG = originalGrammarObj.clone();
            currentGrammarObj = originalGrammarObj.clone().eliminateNulls();
        }
        renderDOMGrammar(currentGrammarObj, 'output-grammar', oldG);
        
        btnNulls.classList.add('active-step');
        btnUnits.classList.remove('active-step');
        btnUseless.classList.remove('active-step');
    });

    btnUnits.addEventListener('click', () => {
        if (!originalGrammarObj) return;
        const isSeq = toggleSequence.checked;
        
        let oldG;
        if (isSeq) {
            sysLogger.system("--- SEQUENCE STEP 2 ---");
            let tempG = originalGrammarObj.clone().eliminateNulls();
            oldG = tempG.clone();
            currentGrammarObj = tempG.eliminateUnits();
        } else {
            oldG = originalGrammarObj.clone();
            currentGrammarObj = originalGrammarObj.clone().eliminateUnits();
        }
        renderDOMGrammar(currentGrammarObj, 'output-grammar', oldG);
        
        btnUnits.classList.add('active-step');
        btnNulls.classList.remove('active-step');
        btnUseless.classList.remove('active-step');
    });

    btnUseless.addEventListener('click', () => {
        if (!originalGrammarObj) return;
        const isSeq = toggleSequence.checked;
        
        let oldG;
        if (isSeq) {
            sysLogger.system("--- SEQUENCE STEP 3 ---");
            let tempG = originalGrammarObj.clone().eliminateNulls().eliminateUnits();
            oldG = tempG.clone();
            currentGrammarObj = tempG.eliminateUseless();
        } else {
            oldG = originalGrammarObj.clone();
            currentGrammarObj = originalGrammarObj.clone().eliminateUseless();
        }
        renderDOMGrammar(currentGrammarObj, 'output-grammar', oldG);
        
        btnUseless.classList.add('active-step');
        btnNulls.classList.remove('active-step');
        btnUnits.classList.remove('active-step');
    });

    btnReset.addEventListener('click', () => {
        if (originalGrammarObj) {
            currentGrammarObj = originalGrammarObj.clone();
            renderDOMGrammar(currentGrammarObj, 'output-grammar');
            sysLogger.system("--- Pipeline Reset to Parsed State ---");
            
            btnNulls.classList.remove('active-step');
            btnUnits.classList.remove('active-step');
            btnUseless.classList.remove('active-step');
        }
    });
});
