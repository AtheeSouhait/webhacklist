<!--
Thanks for the pull request. Delete whatever does not apply — a one-line link fix
does not need a filled-in form, and nobody will ask you to write one.
Details: https://github.com/irsdl/webhacklist/blob/master/CONTRIBUTING.md
-->

## What this changes

<!-- One or two sentences. If it closes an issue: Closes #123 -->

## Type of change

- [ ] Dead or wrong link replaced in a year list
- [ ] Researcher credit corrected
- [ ] Faulty capture reported or repaired
- [ ] Website change (`website/`)
- [ ] Tooling, docs or workflow
- [ ] New technique added to a year list — **needs a submission issue and a judgement first** (see [CONTRIBUTING](../CONTRIBUTING.md#submitting-research))

## Checks

- [ ] No generated file is edited by hand — `website/data/**`, `archived-references/document-gaps.md`, `archived-references/store-gaps.md`
- [ ] If year-list or archive data changed: `node website/build-data.mjs` and `node website/build-data.mjs --check` passed; generated `website/data/` stayed out of the commit
- [ ] If collection records changed: README rows, totals and preliminary counts pass `node website/readme-counts-test.mjs`
- [ ] If anything under `website/` changed: the archive/link smoke suite passes through the [isolated container runner](../website/README.md#run-it)
- [ ] If website themes, navigation, popups or readers changed: the [website regression suite](../website/README.md#regression-coverage-for-future-website-changes) passes, with regression coverage for any new bug fix

Automated agents generate data and inspect archived content through the approved
offline Docker sandbox described in the website guide. Publication also requires
the crawlable-page checks and both host staging targets.

## Sources

<!-- For a link fix or a credit fix: where the replacement or the name comes from.
     A Wayback capture, the author's new domain, the byline in the document. -->
