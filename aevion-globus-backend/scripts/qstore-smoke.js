#!/usr/bin/env node
/** qstore-smoke.js — 6 read-only checks for QStore */
const BASE = process.env.BASE || "https://aevion-production-a70c.up.railway.app";
let pass = 0, fail = 0;
async function check(label, fn) {
  try { const r = await fn(); if(r){console.log("  ✓  "+label);pass++;}else{console.log("  ✗  "+label+" — falsy");fail++;} }
  catch(e){console.log("  ✗  "+label+" — "+e.message);fail++;}
}
async function get(path,expect=200){const r=await fetch(`${BASE}${path}`,{signal:AbortSignal.timeout(6000)});if(r.status!==expect)throw new Error("HTTP "+r.status);return r.json();}
(async()=>{
  console.log(`\nQStore Smoke → ${BASE}\n`);
  await check("GET /api/qstore/health returns ok", async()=>{const d=await get("/api/qstore/health");return d.status==="ok"||d.online||d.ok;});
  await check("GET /api/qstore/categories returns array", async()=>{const d=await get("/api/qstore/categories");return Array.isArray(d.categories||d.items||d);});
  await check("GET /api/qstore/products returns array", async()=>{const d=await get("/api/qstore/products");return Array.isArray(d.items||d.products||d);});
  await check("GET /api/qstore/products?limit=5 returns ≤5", async()=>{const d=await get("/api/qstore/products?limit=5");const arr=d.items||d.products||d;return Array.isArray(arr)&&arr.length<=5;});
  await check("GET /api/qstore/products/bad → 404", async()=>{await get("/api/qstore/products/nonexistent_xyz",404);return true;});
  await check("GET /api/qstore/me/orders requires auth (401)", async()=>{await get("/api/qstore/me/orders",401);return true;});
  console.log(`\n${pass+fail} checks — ${pass} passed, ${fail} failed\n`);
  process.exit(fail>0?1:0);
})();
