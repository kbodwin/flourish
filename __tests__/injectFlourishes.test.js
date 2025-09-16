const fs = require('fs');
const path = require('path');
const vm = require('vm');

// test utils
function loadIntoContext(filename, baseCtx = {}) {
    const root = path.resolve(__dirname, '..');
    const candidates = [
        path.join(root, filename),
        path.join(root, '_extensions', 'flourish', filename),
    ];
    let code, used;
    for (const p of candidates) {
        try { code = fs.readFileSync(p, 'utf8'); used = p; break; } catch { }
    }
    if (!code) throw new Error(`Not found: ${candidates.join(' | ')}`);
    const ctx = vm.createContext({ console, window, document, module: {}, exports: {}, ...baseCtx });
    vm.runInContext(code, ctx, { filename: used });
    return ctx;
}


describe('injectFlourishes.js helpers', () => {
    let ctx;
    beforeAll(() => {
        ctx = loadIntoContext('_extensions/flourish/injectFlourishes.js');
    });

    test('getCumSum sums progressively', () => {
        expect(ctx.getCumSum([1, 2, 3, 4])).toEqual([1, 3, 6, 10]);
    });

    test('getSplitInfo classifies tags vs text and reports spans', () => {
        const rows = ctx.getSplitInfo(['ab', '<em>', 'cd', '</em>']);
        const types = rows.map(r => r.type);
        expect(types).toEqual(['text', 'tags', 'text', 'tags']);
        expect(rows[0]).toMatchObject({ original: 'ab', start: 0, end: 2 });
        expect(rows[2]).toMatchObject({ original: 'cd' });
    });

    test('findTargets returns match ranges for regex', () => {
        const hits = ctx.findTargets('abc abc', /ab/g);
        expect(hits).toEqual([
            { match: 'ab', start: 0, end: 2 },
            { match: 'ab', start: 4, end: 6 },
        ]);
    });
});

describe('injectFlourishes core', () => {
    let ctx;
    beforeAll(() => {
        ctx = loadIntoContext('_extensions/flourish/injectFlourishes.js');
    });

    test('wraps a simple match with span and class', () => {
        const html = 'abc def xyz';
        const out = ctx.injectFlourishes(html, /def/g, 'flr-x');
        expect(out).toBe('abc <span class="flr-x">def</span> xyz');
    });

    test('handles matches crossing tag boundaries', () => {
        const html = 'ab<em>c</em>d';
        const out = ctx.injectFlourishes(html, /bcd/g, 'flr-x');
        expect(out).toBe(
            'a<span class="flr-x">b</span><em><span class="flr-x">c</span></em><span class="flr-x">d</span>'
        );
    });

    test('mask=true replaces matched content with spaces of equal length', () => {
        const html = 'hello';
        const out = ctx.injectFlourishes(html, /ell/g, 'flr-x', true);
        expect(out).toBe('h<span class="flr-x">   </span>o');
    });

    test('non-text (tags) remain unchanged', () => {
        const html = '<code>abc</code>';
        const out = ctx.injectFlourishes(html, /b/g, 'flr-x');
        expect(out).toBe('<code>a<span class="flr-x">b</span>c</code>');
    });
});
