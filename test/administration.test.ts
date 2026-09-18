import test from "node:test";
import assert from "node:assert/strict";
import { beginSetup, cancelSetupDraft, preview, resumeSetupDraft, satisfies, updateDraft, validateForConfirmation, validateRankGraph, type PermissionRole, type ServerConfig, type StoredSetupDraft } from "../src/index.js";

class DurableSetupFake {
  config:ServerConfig|undefined;draft:StoredSetupDraft|undefined;
  async loadSetupDraft(){return this.draft?structuredClone(this.draft):undefined}
  async saveSetupDraft(draft:StoredSetupDraft){this.draft=structuredClone(draft)}
  async deleteSetupDraft(){this.draft=undefined}
}

test("setup drafts survive wizard replacement, resume, cancel, and expire safely",async()=>{
  const store=new DurableSetupFake();let draft=await resumeSetupDraft(store,"guild","admin",undefined,new Date("2026-01-01"));
  draft={...draft,...updateDraft(draft,{organizationName:"Example Guild"},"namespace")};await store.saveSetupDraft(draft);
  const resumed=await resumeSetupDraft(store,"guild","admin",undefined,new Date("2026-01-02"));assert.equal(resumed.stage,"namespace");assert.match(preview(resumed),/Example Guild/);
  await cancelSetupDraft(store,"guild","admin");assert.equal(store.draft,undefined);
});

test("setup validation requires complete configuration at preview",()=>{
  let draft=beginSetup();draft=updateDraft(draft,{guildId:"guild",organizationName:"Example Guild"},"namespace");draft=updateDraft(draft,{commandNamespace:"example"},"integration");
  draft=updateDraft(draft,{confidentialityMarker:"[PRIVATE]",modules:{briefings:false,patrols:false,supply:false,atlas:false}},"preview");
  assert.doesNotThrow(()=>validateForConfirmation(draft));assert.match(preview(draft),/\/example/);
  assert.throws(()=>validateForConfirmation({...draft,config:{...draft.config,commandNamespace:"Not Valid"}}),/incomplete/);
});

test("rank graph rejects self and dangling edges while allowing same-tier branches",()=>{
  assert.doesNotThrow(()=>validateRankGraph(["a","b","c"],[{fromRankId:"a",toRankId:"b"},{fromRankId:"a",toRankId:"c"}]));
  assert.throws(()=>validateRankGraph(["a"],[{fromRankId:"a",toRankId:"a"}]),/itself/);
  assert.throws(()=>validateRankGraph(["a"],[{fromRankId:"a",toRankId:"missing"}]),/unknown/);
});

test("permission resolution supports multiple configured roles and deleted role IDs fail closed",()=>{
  const mappings:PermissionRole[]=[{guildId:"g",roleId:"one",tier:"LEVEL_2"},{guildId:"g",roleId:"two",tier:"LEVEL_2"},{guildId:"g",roleId:"senior",tier:"LEVEL_4"}];
  assert.equal(satisfies(["two"],"LEVEL_2",mappings),true);assert.equal(satisfies(["senior"],"LEVEL_3",mappings),true);assert.equal(satisfies(["deleted"],"BASELINE",mappings),false);
});
