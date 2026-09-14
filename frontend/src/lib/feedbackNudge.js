const copy = {
    1: 'Help us make 1time.io better',
    2: 'Using 1time.io at work? Tell us what you need',
    3: 'Missing something? Propose a feature',
};

export function showFeedbackNudge(root, src) {
    const nudge = root.querySelector('[data-feedback-nudge]');
    const link = nudge?.querySelector('a');
    if (!nudge || !link) return;

    const v = 1 + Math.floor(Math.random() * 3);
    link.href = `/feedback/?src=${src}&v=${v}`;
    link.textContent = copy[v];
    nudge.hidden = false;
}
