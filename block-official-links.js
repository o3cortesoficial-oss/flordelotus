(function () {
  function isOfficialCreamyLink(anchor) {
    if (!anchor || !anchor.href) return false;
    try {
      var hostname = new URL(anchor.href, window.location.href).hostname.toLowerCase();
      return hostname === 'creamy.com.br' || hostname === 'www.creamy.com.br';
    } catch (_) {
      return false;
    }
  }

  function blockOfficialNavigation(event) {
    var anchor = event.target && event.target.closest
      ? event.target.closest('a[href]')
      : null;
    if (!isOfficialCreamyLink(anchor)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  document.addEventListener('click', blockOfficialNavigation, true);
  document.addEventListener('auxclick', blockOfficialNavigation, true);
})();
