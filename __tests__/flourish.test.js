const fs = require('fs');
const path = require('path');
const vm = require('vm');

function runScripts(files, baseCtx = {}) {
    const ctx = vm.createContext({
        console,
        window,
        document,
        module: {},
        exports: {},
        ...baseCtx,
    });
    for (const f of files) {
        const code = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
        vm.runInContext(code, ctx, { filename: f });
    }
    return ctx;
}

describe('parseDataFlourish + addStyle + DOMContentLoaded pipeline', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = `
      <div class="cell" data-flourish='[{"target":"1 < 2"}]'>
        <pre><code>1 &lt; 2 &amp; 3</code></pre>
      </div>

      <div class="cell" data-flourish='[{"target":"foo","style":"font-weight:bold;"}]'>
        <pre><code>foo bar</code></pre>
      </div>

      <div class="cell" data-flourish='[{"target":"secret","mask":true}]'>
        <div class="cell-output"><pre><code>secret in output</code></pre></div>
        <pre><code>secret here</code></pre>
      </div>

      <div class="cell" data-flourish='[{"target":"skip-me"}]'>
        <div class="cell-output-stdout"><pre><code>skip-me</code></pre></div>
      </div>
    `;
    });

    test('parseDataFlourish builds correct regex and defaults', () => {
        const ctx = runScripts([
            '_extensions/flourish/injectFlourishes.js',
            '_extensions/flourish/flourish.js'
        ]);
        const attr = JSON.stringify([
            { target: ['A < B', { source: 'C&D', flags: 'gi' }], mask: true },
            { 'target-rx': ['b..z', { source: 'q(u|x)', flags: 'i' }] },
        ]);
        const parsed = ctx.parseDataFlourish(attr);

        // Entry 0 from "target" should escape HTML entities and set flags from last item if provided
        expect(parsed[0]).toMatchObject({ type: 'target', mask: true });
        expect(Object.prototype.toString.call(parsed[0].regex)).toBe('[object RegExp]');
        expect(parsed[0].regex.flags).toMatch(/g/); // default 'g' unless overridden per entry

        // Entry from "target-rx" is a grouped alternation with provided flags
        const rxEntry = parsed.find(e => e.type === 'target-rx');
        expect(Object.prototype.toString.call(rxEntry.regex)).toBe('[object RegExp]');
        expect(rxEntry.regex.flags).toMatch(/i/);
    });

    test('addStyle injects default style once and custom style classes when used', () => {
        const ctx = runScripts([
            '_extensions/flourish/injectFlourishes.js',
            '_extensions/flourish/flourish.js'
        ]);
        // Fire DOMContentLoaded to process cells
        document.dispatchEvent(new Event('DOMContentLoaded'));

        const styles = [...document.head.querySelectorAll('style')].map(s => s.textContent);
        // Default class present
        expect(styles.join('\n')).toContain('.flr-default');
        // First custom gets numbered class
        expect(styles.join('\n')).toMatch(/\.(flr-custom-1)\s*\{/);
    });

    test('pipeline flourishes code blocks not in outputs and respects HTML-escaped targets', () => {
        const ctx = runScripts([
            '_extensions/flourish/injectFlourishes.js',
            '_extensions/flourish/flourish.js'
        ]);
        document.dispatchEvent(new Event('DOMContentLoaded'));

        const code1 = document.querySelectorAll('.cell pre code')[0];
        expect(code1.innerHTML).toBe(
            '1 <span class="flr-default">&lt;</span> 2 &amp; 3'
        ); // matched " < " which is "&lt;" in HTML

        // Custom style class applied to second cell "foo"
        const code2 = document.querySelectorAll('.cell pre code')[1];
        expect(code2.innerHTML).toBe('<span class="flr-custom-1">foo</span> bar');

        // Masked in third cell for the code outside .cell-output
        const code3 = document.querySelectorAll('.cell pre code')[2];
        expect(code3.innerHTML).toBe('<span class="flr-default">      </span> here');

        // Ensure .cell-output and .cell-output-stdout were skipped
        const out1 = document.querySelector('.cell-output code').innerHTML;
        const out2 = document.querySelector('.cell-output-stdout code').innerHTML;
        expect(out1).toBe('secret in output');
        expect(out2).toBe('skip-me');
    });
});
