# Test fixture: SAMPLE data

A frozen copy of the SAMPLE output (`npm run sample`) and the config it was made with.
Scenario tests (approve this shift, check that conflict) run against this copy, so they
keep passing after `npm run pipeline` replaces `data/generated/` with real output.
Tests of the real generated files only check that they load and match the schemas.

To refresh it on purpose: `npm run sample`, then copy `config/*.json` and
`data/generated/tpm/` here again.

`data/raw/` holds a frozen copy of the original placeholder articles and JDs, which the
orchestrator test (`tests/pipeline.test.ts`) runs on with a fake client, so it does not
depend on the real articles and JDs in the top-level `data/raw/`.
