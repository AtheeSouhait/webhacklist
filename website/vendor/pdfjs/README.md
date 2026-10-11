# PDF.js vendored build

- Version: `5.7.284`
- Upstream: <https://github.com/mozilla/pdf.js/releases/tag/v5.7.284>
- Release asset: `pdfjs-5.7.284-dist.zip`
- SHA-256: `6d1b81252d76358df5831567d7d551f40ebae0cd8e0a554694bc4df0d3db8715`
- License: Apache-2.0; see `LICENSE` and the component licence files in
  `web/cmaps/`, `web/standard_fonts/`, and `web/wasm/`.

Only the display library, worker, character maps, standard fonts, and WASM image
decoders used by the archive's custom reader are retained from the official
distribution. The generic viewer and source maps are intentionally omitted.

The display module, worker, cmaps, standard fonts and WASM decoders are one
release. Both hosts stage these bytes and the worker wrapper/polyfills under
`vendor/pdfjs/releases/<sha256>/`. The reader resolves every component from that
one root, so old immutable fixed-path caches cannot mix into a new release.
The build validates the root against all payload bytes and licences. After any
dependency, wrapper or polyfill change, run
`node website/pdfjs-release-build.mjs --print-path`, update `PDFJS_RELEASE_PATH`
in `website/pdfjs-release.mjs`, and test both staged hosting targets and the
warmed-cache regression. Never change bytes under an existing release hash.

Legacy fixed paths are retained for the migration and revalidate on Cloudflare.
Cloudflare's `_headers` cannot control GitHub Pages response headers. GitHub's
ten-minute reader/manifest cache can delay switching releases; whichever root a
reader receives still identifies one internally consistent bundle. A document
already open stays on its selected release. Removed release paths can return
404 after a future deployment, so reload the reader to select the current root;
they must never be aliased to new release bytes.
