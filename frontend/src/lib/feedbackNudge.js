// The small "help us get better" link shown after a link is created and after a
// secret or file is read. Loaded through a dynamic import() only once that
// screen is up, so it costs nothing on first paint.
//
// The number rides in the link as `v`. Never reword a variant in place: add a
// new number, or clicks and submissions for two different texts share a bucket.
// The backend accepts only the numbers listed here (feedbackVariants).
const copy = {
    1: 'Help us make 1time.io better',
    2: 'Using 1time.io at work? Tell us what you need',
    3: 'Missing a feature? Vote on what we build next',
};

/**
 * Fill and reveal the nudge inside `root`, with a copy variant picked at random.
 * @param {ParentNode} root
 * @param {'ready' | 'read'} src
 */
export function showFeedbackNudge(root, src) {
    const nudge = root.querySelector('[data-feedback-nudge]');
    const link = nudge?.querySelector('a');
    if (!nudge || !link) return;

    const v = 1 + Math.floor(Math.random() * 3);
    link.href = `/feedback/?src=${src}&v=${v}`;
    link.textContent = copy[v];
    nudge.hidden = false;
}
