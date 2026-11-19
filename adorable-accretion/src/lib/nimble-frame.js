(() => {
	const profilesURL = '/api/nimble/profiles';

	async function request(options, failureMessage) {
		let response;
		try {
			response = await fetch(profilesURL, { ...options, credentials: 'same-origin', cache: 'no-store' });
		} catch {
			throw new Error(failureMessage);
		}
		if (response.status === 401) {
			throw new Error('Your Tavern session has expired. Sign in again to access your characters.');
		}
		const data = await response.json().catch(() => {
			throw new Error(failureMessage);
		});
		if (!response.ok) throw new Error(data.error || failureMessage);
		return data;
	}

	window.NimbleProfileStore = {
		async load() {
			const { profiles } = await request({}, 'Could not load your Tavern characters. Reload the Library to try again.');
			return profiles;
		},
		async save(name, profile, overwrite) {
			await request({
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, profile, overwrite }),
			}, 'Could not save your character. Your changes are still on screen; try again.');
		},
	};

	document.documentElement.classList.add('tavern-reference');
	if (window.parent !== window) {
		const host = window.parent.document.documentElement;
		const matchTheme = () => document.documentElement.classList.toggle('dark', host.classList.contains('dark'));
		matchTheme();
		new MutationObserver(matchTheme).observe(host, { attributes: true, attributeFilter: ['class'] });
	}
})();
