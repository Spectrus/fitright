(function () {
	function openTryOn(params) {
		const { name, price, imageUrl, selectedSize } = params || {};
		const qs = `?name=${encodeURIComponent(name || '')}` +
			`&price=${encodeURIComponent(price || '')}` +
			`&imgUrl=${encodeURIComponent(imageUrl || '')}` +
			`&size=${encodeURIComponent(selectedSize || '')}` +
			`&openTryOn=1`;
		const target = 'leather_jackets1.html' + qs;
		window.location.href = target;
	}

	window.TryOn = {
		showTryOnInterface: openTryOn
	};
})();


