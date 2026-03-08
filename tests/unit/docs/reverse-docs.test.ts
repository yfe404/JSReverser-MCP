/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, it} from 'node:test';

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

describe('reverse workflow docs', () => {
  it('documents task artifacts, local rebuild, and Codex workflow guidance', async () => {
    const readme = await readRepoFile('README.md');
    const caseIndex = await readRepoFile('scripts/cases/README.md');
    const reverseIndex = await readRepoFile('docs/reference/reverse-task-index.md');
    const artifactsDoc = await readRepoFile('docs/reference/reverse-artifacts.md');
    const caseSafetyPolicy = await readRepoFile('docs/reference/case-safety-policy.md');
    const reverseWorkflowDoc = await readRepoFile('docs/reference/reverse-workflow.md');
    const reverseBootstrapDoc = await readRepoFile('docs/reference/reverse-bootstrap.md');
    const envPatchingDoc = await readRepoFile('docs/reference/env-patching.md');
    const updatePromptTemplate = await readRepoFile('docs/reference/reverse-update-prompt-template.md');
    const reverseReportTemplate = await readRepoFile('docs/reference/reverse-report-template.md');
    const algorithmUpgradeTemplate = await readRepoFile('docs/reference/algorithm-upgrade-template.md');
    const toolReference = await readRepoFile('docs/reference/tool-reference.md');
    const toolIoContract = await readRepoFile('docs/reference/tool-io-contract.md');
    const outputContract = await readRepoFile('skills/mcp-js-reverse-playbook/references/output-contract.md');
    const envTemplate = await readRepoFile('artifacts/tasks/_TEMPLATE/env/env.js');
    const polyfillsTemplate = await readRepoFile('artifacts/tasks/_TEMPLATE/env/polyfills.js');
    const entryTemplate = await readRepoFile('artifacts/tasks/_TEMPLATE/env/entry.js');
    const docsRootEntries = await readdir(path.join(repoRoot, 'docs'), {withFileTypes: true});
    const docsRootFiles = docsRootEntries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();

    assert.ok(readme.includes('Core methodology'));
    assert.ok(readme.includes('Established pipelines'));
    assert.ok(readme.includes('Supported capabilities'));
    assert.ok(readme.includes('Documentation entry'));
    assert.ok(readme.includes('Reference projects'));
    assert.ok(readme.includes('JD `h5st` parameter'));
    assert.ok(readme.includes('[scripts/cases/README.md](scripts/cases/README.md)'));
    assert.ok(readme.includes('Git only commits `artifacts/tasks/_TEMPLATE/` by default'));
    assert.deepStrictEqual(docsRootFiles, []);
    assert.ok(caseIndex.includes('JD `h5st` parameter'));
    assert.ok(caseIndex.includes('[scripts/cases/jd-h5st-pure-node.mjs](jd-h5st-pure-node.mjs)'));
    assert.ok(caseIndex.includes('Kuaishou `falcon` anti-fraud parameter'));
    assert.ok(caseIndex.includes('When adding new public parameters or pipeline entries, update this file'));
    assert.ok(caseIndex.includes('Category: Parameter signing'));
    assert.ok(caseIndex.includes('Status: abstract-case'));
    assert.ok(caseIndex.includes('Runtime: pure-node'));
    assert.ok(caseIndex.includes('Field specification'));
    assert.ok(reverseIndex.includes('export_rebuild_bundle'));
    assert.ok(reverseIndex.includes('record_reverse_evidence'));
    assert.ok(artifactsDoc.includes('timeline.jsonl'));
    assert.ok(artifactsDoc.includes('Minimum required files'));
    assert.ok(artifactsDoc.includes('Optional files'));
    assert.ok(artifactsDoc.includes('run/exported-runtime.js'));
    assert.ok(artifactsDoc.includes('portable runtime'));
    assert.ok(reverseWorkflowDoc.includes('Model execution protocol'));
    assert.ok(reverseWorkflowDoc.includes('Observe-first'));
    assert.ok(reverseWorkflowDoc.includes('env rebuild'));
    assert.ok(readme.includes('reverse-update-prompt-template'));
    assert.ok(readme.includes('reverse-report-template'));
    assert.ok(reverseBootstrapDoc.includes('The first formal working reply must include'));
    assert.ok(reverseBootstrapDoc.includes('Current stage'));
    assert.ok(updatePromptTemplate.includes('first divergence'));
    assert.ok(updatePromptTemplate.includes('Do not guess'));
    assert.ok(reverseReportTemplate.includes('Target interface and fields'));
    assert.ok(reverseReportTemplate.includes('task artifact'));
    assert.ok(caseSafetyPolicy.includes('Only `artifacts/tasks/_TEMPLATE/` is allowed to be committed by default'));
    assert.ok(caseSafetyPolicy.includes('Real `artifacts/tasks/<task-id>/` directories are treated as local private task directories by default'));
    assert.ok(caseSafetyPolicy.includes('When adding new official documents, do not place them directly in the `docs/` root directory'));
    assert.ok(algorithmUpgradeTemplate.includes('first divergence'));
    assert.ok(algorithmUpgradeTemplate.includes('targetFunctionNames'));
    assert.ok(algorithmUpgradeTemplate.includes('env rebuild'));
    assert.ok(toolReference.includes('targetActionDescription'));
    assert.ok(toolReference.includes('targetFunctionNames'));
    assert.ok(toolIoContract.includes('Canonical Store'));
    assert.ok(outputContract.includes('targetContext'));
    assert.ok(outputContract.includes('targetActionDescription'));
    assert.ok(envPatchingDoc.includes('MCP page forensics'));
    assert.ok(envPatchingDoc.includes('capture.json'));
    assert.ok(envPatchingDoc.includes('Do not guess the environment'));
    assert.ok(envPatchingDoc.includes('Proxy diagnostic layer'));
    assert.ok(envPatchingDoc.includes('Patch decision table'));
    assert.ok(envPatchingDoc.includes('Negative examples'));
    assert.ok(envPatchingDoc.includes('Two-stage objectives'));
    assert.ok(envPatchingDoc.includes('Portable JS export'));
    assert.ok(envTemplate.includes('globalThis.window = globalThis'));
    assert.ok(envTemplate.includes('globalThis.localStorage ??='));
    assert.ok(polyfillsTemplate.includes('globalThis.watch = function watch'));
    assert.ok(polyfillsTemplate.includes('globalThis.makeFunction = function makeFunction'));
    assert.ok(polyfillsTemplate.includes('[env:get]'));
    assert.ok(entryTemplate.includes('import "./env.js";'));
    assert.ok(entryTemplate.includes('import "./polyfills.js";'));
  });
});
