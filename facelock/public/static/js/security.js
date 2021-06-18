/**
 * Get the latest token and srand
 */
!function() {
	/**
	 * Get the latest token and srand
	 */
	var security = {
		token: undefined, srand: undefined
	};

	/**
	 * Get new token and srand
	 */
	function update(data, callback) {
		security.token = data.token;
		security.srand = data.srand;
		callback();
	}

	/**
	 * Initialize
	 */
	function init(callback) {
		/**
		 * Get token and srand
		 */
		edger.token().then(data => {
			update(data, callback);
		}).catch(() => {
			console.log('Not in EdgerOS!');
		});

		/**
		 * Update srand
		 */
		edger.onAction('token', data => {
			update(data, callback);
		});
	}

	/**
	 * Export
	 */
	window.app = window.app || {};
	window.app.security = security;
	window.app.security.init = init;
}();