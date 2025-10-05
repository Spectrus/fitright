(function(){
	function ensureInPageUI() {
		let overlay = document.getElementById('inpageTryOnOverlay');
		if (overlay) return overlay;
		overlay = document.createElement('div');
		overlay.id = 'inpageTryOnOverlay';
		overlay.className = 'inpage-tryon-overlay';

		const panel = document.createElement('div');
		panel.className = 'inpage-tryon-panel';
		const closeBtn = document.createElement('button');
		closeBtn.className = 'inpage-tryon-close';
		closeBtn.innerHTML = '&times;';
		const stage = document.createElement('div');
		stage.className = 'inpage-tryon-stage';
		const iframe = document.createElement('iframe');
		iframe.className = 'inpage-tryon-iframe';
		iframe.title = 'Virtual Try-On';
		iframe.loading = 'eager';

		stage.appendChild(iframe);
		panel.appendChild(closeBtn);
		panel.appendChild(stage);
		overlay.appendChild(panel);
		document.body.appendChild(overlay);

		function hide() {
			overlay.classList.remove('show');
			iframe.src = 'about:blank';
		}
		closeBtn.addEventListener('click', hide);
		overlay.addEventListener('click', (e)=>{ if (e.target === overlay) hide(); });
		return overlay;
	}

	function startInPage(params) {
		const { name, price, imageUrl, selectedSize } = params || {};
		const overlay = ensureInPageUI();
		const iframe = overlay.querySelector('.inpage-tryon-iframe');
		const qs = `?name=${encodeURIComponent(name||'')}`+
			`&price=${encodeURIComponent(price||'')}`+
			`&imgUrl=${encodeURIComponent(imageUrl||'')}`+
			`&size=${encodeURIComponent(selectedSize||'')}`+
			`&openTryOn=1&embed=1`;
		iframe.src = 'leather_jackets1.html' + qs;
		overlay.classList.add('show');
	}

	window.TryOnCore = { startInPage };
})();


