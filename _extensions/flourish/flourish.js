document.addEventListener("DOMContentLoaded", () => {
    // Add default styleSheet; set custom counter to 1
    addStyle(document);
    let styleCounter = 1;

    // Find all flourish cells
    const flourishCells = document.querySelectorAll('div.cell[data-flourish]');

    // LOGGING
    console.log(`Found ${flourishCells.length} cells with data-flourish attribute`);

    // Process each flourish cell
    for (const cell of flourishCells) {

        const flourishAttr = cell.getAttribute('data-flourish');
        const parsedData = parseDataFlourish(flourishAttr);
        if (!parsedData) continue;

        // Find only the code chunks you care about
        const sourceEls = Array.from(cell.querySelectorAll('code'))
            .filter(el =>
                !el.closest('.cell-output') &&
                !el.closest('.cell-output-stdout') &&
                el.dataset.flourished !== 'true' // idempotent per element
            );

        // For each code chunk, add flourishes
        for (const el of sourceEls) {

            let content = el.innerHTML;

            // For each regex, look for it and flourish
            for (const pattern of parsedData) {
                // Default className
                let className = "flr-default";
                let styles = pattern.style;

                // If pattern includes a custom style, insert the style block
                if (styles !== 'default') {

                    // Join multiple elements into string
                    const classText = (Array.isArray(styles) ? styles : [styles]).join('\n');

                    // Generate a unique class name
                    className = `flr-custom-${styleCounter}`;

                    addStyle(document, className, classText);
                    styleCounter++;
                }

                // Apply flourishes with the appropriate class name
                content = injectFlourishes(content, pattern.regex, className, pattern.mask);
            }

            el.innerHTML = content;
            el.dataset.flourished = 'true';
        }
    }
});

// Hardcode swaps for sanitized HTML
function htmlEntityEscapeForSearch(s) {
    return s
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/&(?![a-zA-Z]+;|#\d+;|#x[0-9A-Fa-f]+;)/g, '&amp;');
}

function escapeForRegexLiteral(s) {
    return RegExp.escape ? RegExp.escape(s) : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function for parsing YAML
function parseDataFlourish(flourishAttr) {
    try {
        const entries = [].concat(JSON.parse(flourishAttr));
        const result = [];

        // Each separate "target" in YAML is its own entry
        for (const entry of entries) {
            for (const key of ['target', 'target-rx']) {
                if (!entry[key]) continue;

                // normalize to array
                const items = [].concat(entry[key]);

                // pull style out and collect patterns
                let style = entry.style || 'default';
                let mask = entry.mask || false;
                let flags = entry.flags || 'g';
                const pats = [];

                for (const it of items) {
                    if (typeof it === 'string') {
                        if (key === 'target') {
                            const encoded = htmlEntityEscapeForSearch(it);
                            pats.push(escapeForRegexLiteral(encoded));
                        } else {
                            pats.push(it);
                        }
                    } else if (it && it.style) {
                        style = it.style;
                    } else if (it && it.source) {
                        if (key === 'target') {
                            const encoded = htmlEntityEscapeForSearch(it.source);
                            pats.push(escapeForRegexLiteral(encoded));
                        } else {
                            pats.push(it.source);
                        }
                        if (it.flags) flags = it.flags;
                    } else if (it && it.mask) {
                        mask = it.mask;
                    }
                }

                if (pats.length) {
                    const pattern = key === 'target' ? pats.join('|')
                        : pats.map(p => `(${p})`).join('|');
                    const re = new RegExp(pattern, flags);
                    result.push({ type: key, regex: re, style, mask });
                }
            }
        }
        return result;
    } catch {
        return null;
    }
}

// Function for making style sheets
function addStyle(document, className = "flr-default",
    styleText = `background-color: yellow;
        display: inline;
        color: inherit;`) {
    // Deduplicate styles by class selector
    const selector = `.${className}`;
    const exists = Array.from(document.querySelectorAll('style'))
        .some(s => s.textContent && s.textContent.includes(selector));
    if (exists) return;

    const styleSheet = document.createElement("style");
    styleSheet.textContent = `${selector} { ${styleText} }`;
    document.head.appendChild(styleSheet);
}
