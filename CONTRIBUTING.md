# Contributing

This archive exists because people keep pointing at things it got wrong or left out.
Every route below ends in the same place: a GitHub issue with enough detail to act on.

**The quickest way in** is the **Submit research** button on
[webhacklist.com](https://webhacklist.com/). It searches the archive as you type — so
you find out immediately whether a source is already recorded — and then opens one of
the forms below with your answers already filled in.

| You want to | File this |
|---|---|
| Propose a technique a year's nomination round missed | [Submit research](https://github.com/irsdl/webhacklist/issues/new?template=01-submit-research.yml) |
| Report a cited link that died or now points somewhere else | [Dead or wrong link](https://github.com/irsdl/webhacklist/issues/new?template=02-dead-or-changed-link.yml) |
| Report a preserved copy that captured the wrong page | [Faulty archived copy](https://github.com/irsdl/webhacklist/issues/new?template=03-faulty-capture.yml) |
| Fix a byline, or add a researcher who is missing from one | [Researcher credit](https://github.com/irsdl/webhacklist/issues/new?template=04-author-credit.yml) |
| Report a website bug, or suggest something | [Website bug or idea](https://github.com/irsdl/webhacklist/issues/new?template=05-website-feedback.yml) |

A pull request is welcome for any of these too — see [Pull requests](#pull-requests) for
which files are hand-edited and which are generated.

## Submitting research

### What the lists already contain

The year lists are **complete with respect to the official rounds**: everything that was
nominated for a given year is already in that year's file. Submitting a technique that
was nominated will find it already there.

What the rounds *missed* is the open question. Research gets overlooked — published late
in the year, posted somewhere the nominators did not read, written in a language the
round did not cover. Those are the additions this repository is still making, and they
are what the submission form is for.

### The bar

A submission is judged as a **technique**, on the evidence, against six weighted
categories — originality, transferability, lasting value, technical soundness,
practical usability and clarity/reproducibility. It is
added only if it passes the judging skill’s current Repository collection merit
and the source, year and non-duplication checks. The merit criteria may change. In practice that means:

- **It is a method, not an incident.** A reusable technique other researchers can apply,
  rather than one site's bug report, a product launch, or a CVE with no new method behind
  it.
- **It was genuinely new when published.** Independent rediscovery of an existing
  technique is honest work and still does not qualify — the check is against prior art,
  not against how well known the technique was at the time.
- **The source is the original.** The researcher's own publication: their post, paper,
  advisory, slides or talk. Not a newsletter, aggregator, or a summary written by someone
  else.
- **It belongs to the year it was published**, whatever year you found it.

Submitting your own research is welcome and uses the same criteria. Tick the author
box on the website or select your connection on GitHub so we can address you accurately.
Every submitter can clarify the evidence or challenge a finding.

### What happens after you file

1. **Triage.** Obvious duplicates and out-of-scope reports are closed with a reason. If
   the source is already in the archive you will be pointed at the entry.
2. **Judgement.** The submission is scored in full, with every result re-verified against
   the primary source rather than taken from the write-up, and checked against prior art
   and against the existing entries for the surrounding years.
   If the work may not qualify, we explain the specific concerns, relevant evidence
   and what would clarify them, regardless of your connection to the research.
   We keep the submission open for answers to material questions before deciding.
   An explanation or existing link is welcome; no formal rebuttal is needed.
3. **The record.** Public [`ai-evaluation/<year>/`](ai-evaluation/) records show
   candidate links and **Added / Not added**, with decision dates and merit
   revisions in history. Issue and PR replies thank you for the submission, acknowledge
   a specific aspect of the work and explain each outcome. Full evaluations and scores
   stay in private local notes. A lead
   awaiting review is not added, but has not necessarily failed evaluation.
4. **Addition.** Anything that clears the bar joins its year under
   **"Missed from the original list"** — a section kept visibly separate from the
   original nominations, because the archive never blurs what was nominated with what was
   added later.
5. **Preservation.** The source is then captured into
   [`archived-references/`](archived-references/) as readable Markdown and as a PDF of the
   page as published, so the entry survives its host.

Expect this to take a while. Judging one submission properly is slower than filing it.

### Replies, clarification and reconsideration

An **Added** reply explains why the research is useful to future archive readers
and links the actual addition and available preserved copies. Accepted issues
close once the addition is available. An accepted PR must be merged or have its
changes applied and linked before closure; an acceptance awaiting publication stays open.

When something material is unclear, the reply identifies the affected claim or
section, explains the concern and asks concrete questions. Prior-art comparisons
link and date the earlier work and explain the technical overlap. The issue or PR
stays open for your answer, and the evidence is reassessed against the same criteria.
An explanation or existing link is enough when it resolves the concern; no formal
rebuttal or new experiment is required.

When no material question remains, a **Not added** reply explains the reasons and
the submission can close. You are welcome to defend the work or reopen the issue
with evidence addressing those reasons. If GitHub does not let you reopen it,
comment on the closed thread to request reopening. Reconsideration does not
guarantee inclusion. A preservation problem or missing evidence is described as
such and is not treated as proof that the research lacks merit.

Every AI-generated public comment includes: **"This comment was generated by AI
with no human involvement."** This describes the comment's authorship. A reply
also states whether a human reviewed the judgement when that is known, and
discloses any human assessment input accurately. The same evidence-based criteria
apply to everyone, but AI authorship does not guarantee freedom from bias or error.

If you think the [judging skill](.claude/skills/webseclist-judge-reference/SKILL.md)
or [rubric](.claude/skills/webseclist-judge-reference/references/scoring-rubric.md)
contains an error or needs improvement, [open a separate issue](https://github.com/irsdl/webhacklist/issues/new).
Point to the affected rule and include an example, supporting evidence and any
suggested correction. Discussion is welcome: the policy can be wrong too. Keep
candidate-specific evidence in the original submission so it can be reassessed.

### Review your article with the judge

You can run a self-review before submitting or when responding to feedback.
Clone the repository: the judge needs the historical posts, year lists and current
policy to compare your contribution with earlier work. Pasting the article into
an isolated chat does not provide that local context.

```sh
git clone https://github.com/irsdl/webhacklist.git
cd webhacklist
```

Use an AI coding agent with access to this checkout and web search. Load
[the judge skill](.claude/skills/webseclist-judge-reference/SKILL.md) and
[its scoring rubric](.claude/skills/webseclist-judge-reference/references/scoring-rubric.md)
explicitly; automatic discovery of the skill depends on your agent. You can paste
this request from the repository root, replacing `<ARTICLE_URL>`:

```text
Read CLAUDE.md and .claude/source-security.md. Load and follow
.claude/skills/webseclist-judge-reference/SKILL.md and
.claude/skills/webseclist-judge-reference/references/scoring-rubric.md.
Judge <ARTICLE_URL> against the current Repository collection merit. Read the
complete original disclosure, establish its first-publication cutoff, and search
both archived-references/md/ and the web for prior art using the approved source
handling routes. Reverify the result and explain the strongest case for the work,
the inclusion reasons and any material uncertainties. Do not edit the collection
or contact GitHub. Keep the full report and scores in .local/ai-evaluation/;
give me an evidence-based explanation suitable for discussing the submission.
```

Follow [the source-handling policy](.claude/source-security.md): Python and a
running Docker daemon are needed for the approved isolated source readers;
use the [source-reader entrypoint](.claude/source-security.md#approved-local-entrypoints-and-current-limits)
and [capture setup guide](tools/README.md) as applicable. Missing access or a failed
required sandbox leaves the review pending; it is not a failed research judgement.
The agent must read the complete source, search both the local archive and web,
respect the publication-time evidence boundary, and reverify its conclusion.
`score.py` only calculates the weighted total from supplied values; it does not
perform that review.

Local results may differ with the available evidence, model behaviour and skill
revision. Cite the checkout commit and relevant sources when discussing a
disagreement. Keep numerical scores and full scorecards local; share the
qualitative reasons, evidence and questions in the submission. Running the judge
yourself is optional: you can always challenge a finding by explaining it and
providing relevant evidence.

## Reporting a dead link or a bad capture

These two look similar and are handled differently, so the forms ask different things:

- A **dead link** is a *citation* problem — the URL in a year list no longer reaches the
  research. The fix is a replacement URL: the author's new domain, a mirror they
  published, or a Wayback Machine capture.
- A **faulty capture** is an *archive* problem — the preserved copy exists but holds the
  wrong thing: a consent wall, an error page, a parked domain, a truncated render. The
  fix is a recapture, and the reference is filed for one.

Either report is worth filing even when you have no replacement to offer. Knowing a
capture is wrong is most of the work.

## Pull requests

Some files are curated by hand and some are generated. Editing a generated file is the
one change that will always be asked for again:

| Path | |
|---|---|
| `2006.md` … `2025.md`, including `2016-17.md` | **Hand-curated annual collections.** 2016/17 is combined. Edited only for a reviewed addition or a link fix; automation uses `website/archive-years.json`. |
| `<year>-ai.md` | Machine-assembled candidates for a year with no vote yet. Deliberately separate from the curated lists. |
| `archived-references/manifest.json` and `md/`, `pdf/` | Written by the capture tooling. |
| `archived-references/document-gaps.md`, `store-gaps.md` | **Generated** — record the fault on the manifest entry instead. |
| `archived-references/review-gaps.md` | Hand-written, and never overwritten by a tool run. |
| `website/data/` | **Generated, ignored build output** from `node website/build-data.mjs`. Never stage or commit it; both hosts regenerate it. |
| `website/*.html`, `*.css`, `*.js` | Hand-written, dependency-free source with no compilation or framework. Publishing still requires generated data, crawlable pages and host staging. |

For website changes, follow the [website development and validation guide](website/README.md#run-it).
The [maintainer setup checklist](tools/MAINTAINING.md) consolidates dependencies,
preflight and the read-only PR gate.
The dual-origin app preview supports the complete phone PDF flow; generated static
pages have a separate preview. Before opening a website pull request, regenerate
data when lists or archive metadata change, run the dependency-free regressions,
then run the isolated browser suites:

```sh
node --test website/constellation-test.mjs website/generated-data-guard-test.mjs website/pdf-reader-polyfills-test.mjs website/review-regression-test.mjs
python3 website/container-tests.py --node-modules /path/to/approved/node_modules
```

The container runner includes the archive/link smoke test. Automated agents must
generate data and inspect archive content through the approved offline Docker
route described in the guide, rather than a host browser or parser. Before
publication, also check generated-data freshness, README counts, crawlable pages
and both host staging targets as documented there.

The smoke test renders hostile Markdown through the real reader,
checks that no unsafe tag survives, and verifies that every archive path the site can
open is one the manifest actually advertises. Keep it passing.

For a **link fix**, one PR per year list is easiest to review. For a **new technique**,
please open the submission issue first — the judgement has to happen either way, and a
PR that adds an entry cannot short-circuit it.

## Reuse terms for contributions

Original website and tooling code, and its associated software documentation,
is licensed under the [MIT License](LICENSE). Contribute your own original code
under those terms, retaining copyright and permission notices. See
[Reuse & licences](website/reuse.html) for the scope and third-party guidance.

Third-party preserved research, original-listing PDFs, attributed or source-derived
collection content and vendored components keep their own rights, terms and credits;
do not apply the project MIT licence to them. Preserve source attribution and
component notices. A CSV or bibliography export supplies citations and links,
not permission to republish the cited work or source-derived text.

## Ground rules

- **Sponsorship buys nothing here.** Entries are added on the evidence — a nomination in
  that year's official round, or a review-gated audit find. No amount of money puts
  research on a list or takes it off one.
- **Preserved material stays its author's work.** Local copies exist for research and
  historical access, and every entry names and links its source. If you are an author and
  want your document removed from the archive, open an issue and it will be removed.
- **Be accurate about attribution.** Getting credit right is the point of keeping a
  record like this. Corrections are always welcome, from anyone.
