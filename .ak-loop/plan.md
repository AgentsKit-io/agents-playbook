Scanned docs/ and content/ for status: historical/superseded/archived/completed (none) and
for historical/superseded/archived wording (only pattern docs, kept). Only candidate:
docs/ecosystem-doc-quality-plan.md (finished plan; git grep of path and basename: no hits).
Deleted it, regenerated doc-bridge index, ran gate, lint, test, build.
Kept: pattern docs mentioning "historical" descriptively, ADR template, CHANGELOG.
No no-silent-deletion gate found; added a removes: trailer anyway.
