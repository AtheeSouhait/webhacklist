// This path identifies the entire reader dependency bundle. The build checks
// its SHA-256 against every vendor byte, the worker wrapper and its polyfills.
export const PDFJS_RELEASE_PATH = "vendor/pdfjs/releases/9c41fe17ac12134a877503f539b61acef4a25b4da555264b51bb46beb87e6bf8";
export const PDFJS_ROOT = new URL(`./${PDFJS_RELEASE_PATH}/`, import.meta.url);
