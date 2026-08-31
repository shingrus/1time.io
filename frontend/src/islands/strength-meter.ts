import {estimate, type Estimate} from '../lib/strength';

/**
 * Lazy chunk: markup, styles and wiring for the strength meter.
 *
 * Nothing in here is imported statically anywhere. The caller pulls it in on the
 * first keystroke that looks credential-shaped, so neither the JS nor the CSS is on
 * the initial render path. The styles ride along as a string instead of a CSS import
 * so loading the meter costs one request, not two.
 */

const STYLE_ID = 'pwc-style';

const CSS = `
.pwc{padding:0 16px 12px;font-size:13px;line-height:1.45}
.pwc[hidden]{display:none}
.pwc-bars{display:flex;gap:4px}
.pwc-seg{flex:1;height:4px;border-radius:2px;background:var(--border);transition:background 250ms ease}
.pwc-row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:2px 10px;margin-top:6px}
.pwc-label{font-weight:600}
.pwc-time{color:var(--text-muted)}
.pwc-hint{color:var(--text-secondary);flex-basis:100%}
.pwc-0,.pwc-1{color:var(--danger)}
.pwc-2{color:var(--warning)}
.pwc-3,.pwc-4{color:var(--success)}
.pwc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.pwc-seg{transition:none}}
`;

const FILL = ['var(--danger)', 'var(--danger)', 'var(--warning)', 'var(--success)', '#065F46'];

export interface StrengthMeter {
    update(value: string): void;
}

export function mountStrengthMeter(slot: HTMLElement): StrengthMeter {
    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    slot.className = 'pwc';
    slot.innerHTML = `
        <div class="pwc-bars" aria-hidden="true">
            <i class="pwc-seg"></i><i class="pwc-seg"></i><i class="pwc-seg"></i><i class="pwc-seg"></i>
        </div>
        <div class="pwc-row" aria-hidden="true">
            <span class="pwc-label" data-label></span>
            <span class="pwc-time" data-time></span>
            <span class="pwc-hint" data-hint></span>
        </div>
        <span class="pwc-sr" role="status" aria-live="polite" data-live></span>`;

    const segments = Array.from(slot.querySelectorAll<HTMLElement>('.pwc-seg'));
    const labelEl = slot.querySelector<HTMLElement>('[data-label]')!;
    const timeEl = slot.querySelector<HTMLElement>('[data-time]')!;
    const hintEl = slot.querySelector<HTMLElement>('[data-hint]')!;
    const liveEl = slot.querySelector<HTMLElement>('[data-live]')!;

    let lastLabel = '';
    let announceTimer = 0;

    const render = (result: Estimate) => {
        slot.hidden = !result.rated;
        if (!result.rated) {
            lastLabel = '';
            return;
        }

        segments.forEach((seg, i) => {
            // Score 0 still paints one red segment — an empty bar reads as "not checked".
            seg.style.background = i <= Math.max(0, result.score - 1) ? FILL[result.score]! : '';
        });
        labelEl.textContent = result.label;
        labelEl.className = `pwc-label pwc-${result.score}`;
        timeEl.textContent = `${result.bits} bits · ${result.crackTime} to crack offline`;
        hintEl.textContent = result.hint;

        // Screen readers get the verdict only when it changes, and only once typing settles.
        if (result.label !== lastLabel) {
            lastLabel = result.label;
            clearTimeout(announceTimer);
            announceTimer = window.setTimeout(() => {
                liveEl.textContent = `Secret strength: ${result.label}. ${result.hint}`;
            }, 700);
        }
    };

    return {update: (value: string) => render(estimate(value))};
}
