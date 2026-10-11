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
release. Update them together and test both staged hosting targets. These are
fixed URLs, so Cloudflare's `_headers` requires revalidation rather than immutable
caching. The active custom reader is on `https://irsdl.github.io/webhacklist/`,
where GitHub Pages controls response headers; `_headers` cannot change them.
Observed on 11 October 2026: GitHub reader/vendor responses advertised
`max-age=600`, while the then-live Cloudflare vendor responses advertised
`max-age=31536000, immutable`. A fresh header policy cannot invalidate copies
already cached with the old lifetime. Before closing the cache finding, deploy
and test a warmed browser across a vendor release; a versioned vendor directory
remains the stronger option for coordinating components on both origins.
