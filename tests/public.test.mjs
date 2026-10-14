import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root=new URL('../',import.meta.url),workshop=JSON.parse(fs.readFileSync(new URL('data/workshop.json',root)));
test('public replay keeps the four modern runs and five-result comparison',()=>{assert.equal(workshop.runs.length,4);assert.equal(JSON.parse(fs.readFileSync(new URL('data/legacy-qwen.json',root))).id,'qwen-coder-archive');});
test('default presentation compares Qwen with and without OpenSpec',()=>{assert.deepEqual([workshop.presentation.leftRun,workshop.presentation.rightRun],['qwen-spec','qwen-direct']);});
test('every run has four isolated roles',()=>{for(const run of workshop.runs)assert.deepEqual(run.roles.map(x=>x.name),['analyst','designer','developer','tester']);});
test('all modern API cost totals include the full request volume',()=>{for(const run of workshop.runs){const calculated=run.metrics.promptTokens*Number(run.pricing.prompt)+run.metrics.completionTokens*Number(run.pricing.completion);assert.ok(Math.abs(calculated-run.metrics.uncachedUsd)<1e-8,run.id);}});
test('prepared UI refinements preserve the original domain logic',()=>{const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');for(const run of workshop.runs.filter(r=>r.refinement))assert.equal(hash('checkpoints/'+run.refinement.id+'/code/dist/domain.js'),hash('checkpoints/'+run.refinement.source+'/code/dist/domain.js'));});
test('both spec refinements apply exactly the same visual contract',()=>{const css=id=>fs.readFileSync(new URL('checkpoints/'+id+'/code/dist/spec-product.css',root),'utf8');assert.equal(css('qspec-ui-12'),css('sdd-ui-20'));});

