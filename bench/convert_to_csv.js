const fs = require('fs');
const path = require('path');

const inputPath = path.join('d:', 'jailbreak-benchmark', 'bench', 'results', '2026-run', 'analysis-cache.json');
const outputPath = path.join('d:', 'jailbreak-benchmark', 'bench', 'results', '2026-run', 'analysis_results.csv');

console.log(`Reading from: ${inputPath}`);
const rawData = fs.readFileSync(inputPath, 'utf8');
const data = JSON.parse(rawData);

// Note: used exactly 'first_vioation_message' in the header as requested.
const headers = ['id', 'model_name', 'first_vioation_message', 'constraint_override_text', 'confidence', 'explanation'];
const rows = [];
rows.push(headers.join(','));

for (const [key, value] of Object.entries(data)) {
    const result = value.result || {};
    const modelName = key.split('--')[0] || key;
    
    const escapeCsv = (str) => {
        if (str === null || str === undefined) return '';
        const s = String(str);
        if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };

    const row = [
        escapeCsv(key),
        escapeCsv(modelName),
        escapeCsv(result.first_violation_message),
        escapeCsv(result.constraint_override_text),
        escapeCsv(result.confidence),
        escapeCsv(result.explanation)
    ];
    rows.push(row.join(','));
}

fs.writeFileSync(outputPath, rows.join('\n'), 'utf8');
console.log(`Successfully wrote ${Object.keys(data).length} rows to: ${outputPath}`);
