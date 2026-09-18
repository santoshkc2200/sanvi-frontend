<!-- Static hosting has no server for a real health endpoint — this route is
what a synthetic monitor hits instead, importing package.json's version and
the FR-1103 release stamp through the same `__APP_VERSION__` / `__APP_BUILD__`
defines the SvelteKit apps use. -->
<pre>{JSON.stringify({ status: 'ok', version: __APP_VERSION__, build: __APP_BUILD__ }, null, 2)}</pre>
