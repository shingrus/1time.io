import {readFileSync} from 'node:fs';
import path from 'node:path';

const cssCache = new Map();

function stripCssComments(css) {
    let result = '';
    let quote = '';
    let inComment = false;

    for (let index = 0; index < css.length; index += 1) {
        const char = css[index];
        const next = css[index + 1];

        if (inComment) {
            if (char === '*' && next === '/') {
                inComment = false;
                index += 1;
            }
            continue;
        }

        if (quote) {
            result += char;
            if (char === quote && css[index - 1] !== '\\') {
                quote = '';
            }
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            result += char;
            continue;
        }

        if (char === '/' && next === '*') {
            inComment = true;
            index += 1;
            continue;
        }

        result += char;
    }

    return result;
}

function minifyCss(css) {
    const withoutComments = stripCssComments(css);
    let result = '';
    let quote = '';
    let pendingSpace = false;

    for (let index = 0; index < withoutComments.length; index += 1) {
        const char = withoutComments[index];

        if (quote) {
            result += char;
            if (char === quote && withoutComments[index - 1] !== '\\') {
                quote = '';
            }
            continue;
        }

        if (char === '"' || char === "'") {
            if (pendingSpace) {
                const previous = result[result.length - 1];
                if (previous && !'{}:;,>'.includes(previous)) {
                    result += ' ';
                }
                pendingSpace = false;
            }

            quote = char;
            result += char;
            continue;
        }

        if (/\s/.test(char)) {
            pendingSpace = true;
            continue;
        }

        if (pendingSpace) {
            const previous = result[result.length - 1];
            if (previous && !'{}:;,>'.includes(previous) && !'{}:;,)]'.includes(char)) {
                result += ' ';
            }
            pendingSpace = false;
        }

        result += char;
    }

    return result.trim();
}

function readCss(file) {
    if (!cssCache.has(file)) {
        const filename = path.join(process.cwd(), file);
        const css = readFileSync(filename, 'utf8');
        cssCache.set(file, minifyCss(css));
    }

    return cssCache.get(file);
}

export default function InlineCss({file}) {
    return (
        <style
            data-inline-css={file}
            dangerouslySetInnerHTML={{__html: readCss(file)}}
        />
    );
}
