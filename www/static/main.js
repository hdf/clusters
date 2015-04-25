//document.body.style.background = "black url('static/background.jpg') no-repeat fixed center center"; // Deferred loading of the 2MB image ( disabled, because server push, and becouse with spdy the browser should know better )

function setLang(lang) {
  document.l10n.requestLocales(lang);
  localStorage.lang = lang;
}

document.addEventListener('DocumentLocalized', function() { // Should only fire once
  if (localStorage.lang) document.l10n.requestLocales(localStorage.lang);
});

if (typeof(render) == 'undefined') { // onload/onresize event queue
  var render = [];
  function renderer() {
    for (var i = 0, n = render.length; i < n; i++)
      render[i]();
  }
}

(function() { // I know, ugly, but there does not seem to be a css3 solution (that works with foundation)
  var first = true;
  function center() {
    if (first) {
      setTimeout(center, 200);
      first = false;
      return;
    }
    var e = document.getElementsByClassName('middle')[0];
    var o = (window.innerHeight - e.offsetHeight) / 2;
    if (o < 0) o = 0;
    e.style.transform = 'translateY(' + o + 'px)';
  }
  render.push(center);
  window.onload = window.onresize = renderer;
})();
