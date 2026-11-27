// Cloudflare caches the HTML, so this GET is what reaches the access log (nginx answers 204).
// Pathname only: the fragment holds the key. The referrer is cut to its host, or its scheme for app referrers.
(function () {
    function sendPageview() {
        var referrer = '';
        try {
            var url = new URL(document.referrer);
            referrer = /^https?:$/.test(url.protocol) ? url.hostname : url.protocol;
        } catch (e) {}
        try {
            fetch('/pv?p=' + encodeURIComponent(location.pathname) + '&r=' + encodeURIComponent(referrer)
                + '&u=' + encodeURIComponent(new URLSearchParams(location.search).get('utm_source') || ''),
                {keepalive: true, credentials: 'omit'}).catch(function () {});
        } catch (e) {}
    }
    if (document.readyState === 'complete') sendPageview();
    else addEventListener('load', sendPageview);
})();
