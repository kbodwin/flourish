const fs = require('fs');
const path = require('path');
const vm = require('vm');

function runScripts(files, baseCtx = {}) {
    const root = path.resolve(__dirname, '..');
    const ctx = vm.createContext({ console, window, document, module: {}, exports: {}, ...baseCtx });
    for (const f of files) {
        const candidates = [path.join(root, f), path.join(root, '_extensions', 'flourish', f)];
        let code, used;
        for (const p of candidates) {
            try { code = fs.readFileSync(p, 'utf8'); used = p; break; } catch { }
        }
        if (!code) throw new Error(`Not found: ${candidates.join(' | ')}`);
        vm.runInContext(code, ctx, { filename: used });
    }
    return ctx;
}

const nonOutputCodes = () =>
    [...document.querySelectorAll('.cell pre code')].filter(
        el => !el.closest('.cell-output') && !el.closest('.cell-output-stdout')
    );

const rxTag = s => Object.prototype.toString.call(s) === '[object RegExp]';

describe('parseDataFlourish + addStyle + DOMContentLoaded pipeline', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = `
      <!-- Escape < in attribute values -->
      <div class="cell" data-flourish='[{"target":"&lt;"}]'>
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

      <div class="cell" data-flourish='[{"target-rx":["ba.","fo+"],"flags":"g"}]'>
        <pre><code>foo bar baz</code></pre>
      </div>
    `;
    });

    test('parseDataFlourish builds correct regex and defaults', () => {
        const ctx = runScripts(['injectFlourishes.js', 'flourish.js']);
        const attr = JSON.stringify([
            { target: ['A < B', { source: 'C&D', flags: 'gi' }], mask: true },
            { 'target-rx': ['b..z', { source: 'q(u|x)', flags: 'i' }] },
        ]);
        const parsed = ctx.parseDataFlourish(attr);

        expect(parsed[0]).toMatchObject({ type: 'target', mask: true });
        expect(rxTag(parsed[0].regex)).toBe(true); // cross-realm safe
        expect(parsed[0].regex.flags).toMatch(/g/);

        const rxEntry = parsed.find(e => e.type === 'target-rx');
        expect(rxTag(rxEntry.regex)).toBe(true);
        expect(rxEntry.regex.flags).toMatch(/i/);
    });

    test('addStyle injects default style once and custom style classes when used', () => {
        runScripts(['injectFlourishes.js', 'flourish.js']);
        document.dispatchEvent(new Event('DOMContentLoaded'));

        const css = [...document.head.querySelectorAll('style')].map(s => s.textContent).join('\n');
        expect(css).toContain('.flr-default');        // default style
        expect(css).toMatch(/\.(flr-custom-1)\s*\{/); // first custom style
    });
    test('pipeline flourishes code blocks and respects HTML-escaped targets', () => {
        runScripts(['injectFlourishes.js', 'flourish.js']);
        document.dispatchEvent(new Event('DOMContentLoaded'));

        const codes = nonOutputCodes();
        const code1 = codes[0]; // first cell
        expect(code1.innerHTML).toBe('1 <span class="flr-default">&lt;</span> 2 &amp; 3');

        const code2 = codes[1]; // second cell
        expect(code2.innerHTML).toBe('<span class="flr-custom-1">foo</span> bar');

        const code3 = codes[2]; // third cell, outside outputs
        expect(code3.innerHTML).toBe('<span class="flr-default">      </span> here');

        expect(document.querySelector('.cell-output code').innerHTML).toBe('secret in output');
        expect(document.querySelector('.cell-output-stdout code').innerHTML).toBe('skip-me');
    });

    test('target-rx wraps multiple patterns in the same block', () => {
        runScripts(['injectFlourishes.js', 'flourish.js']);
        document.dispatchEvent(new Event('DOMContentLoaded'));

        const codes = nonOutputCodes();
        const node = codes[3]; // fifth cell's code block
        const spans = [...node.querySelectorAll('span.flr-default')].map(s => s.textContent);
        expect(spans).toEqual(['foo', 'bar', 'baz']);
    });


    test('idempotent on repeated DOMContentLoaded', () => {
        runScripts(['injectFlourishes.js', 'flourish.js']);
        document.dispatchEvent(new Event('DOMContentLoaded'));
        const before = document.body.innerHTML;
        document.dispatchEvent(new Event('DOMContentLoaded'));
        const after = document.body.innerHTML;
        expect(after).toBe(before); // no double-wrapping
    });
});
