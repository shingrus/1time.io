document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-copy-target]');
    if (!button) return;
    var source = document.getElementById(button.getAttribute('data-copy-target'));
    if (!source) return;
    if (!button.dataset.label) button.dataset.label = button.textContent;
    function flash(text) {
        button.textContent = text;
        setTimeout(function () { button.textContent = button.dataset.label; }, 2500);
    }
    function selectSource() {
        var range = document.createRange();
        range.selectNodeContents(source);
        var selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        flash('Selected, press ' + (/Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? '⌘C' : 'Ctrl+C'));
    }
    if (!navigator.clipboard) return selectSource();
    navigator.clipboard.writeText(source.textContent).then(function () { flash('Copied'); }, selectSource);
});
