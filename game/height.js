// Height negotiation for the Frontier Economics Interactive block.
(function () {
  if (parent === window) return;
  function postHeight() {
    const h = Math.ceil(document.body.getBoundingClientRect().height);
    parent.postMessage({ type: 'frontier-viz:height', height: h }, '*');
  }
  addEventListener('load', postHeight);
  new ResizeObserver(postHeight).observe(document.body);
  addEventListener('message', (e) => {
    if (e.source !== parent) return;
    const msg = e.data || {};
    if (msg.type === 'frontier-viz:request-height') postHeight();
    if (msg.type === 'frontier-viz:fullscreen' || msg.type === 'frontier-viz:fill') {
      document.body.classList.toggle('is-filling', msg.active !== false);
      if (msg.active === false) setTimeout(postHeight, 50);
    }
  });
})();
