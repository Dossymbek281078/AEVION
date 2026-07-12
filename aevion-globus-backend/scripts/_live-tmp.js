const fs=require("fs"),path=require("path"),root=path.join(__dirname,"..");
for(const line of fs.readFileSync(path.join(root,".env"),"utf8").split("\n")){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m&&!line.trim().startsWith("#"))process.env[m[1]]=m[2].trim();}
const O=require(path.join(root,"dist","services","qcoreai","orchestrator.js"));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function run(label,q){
  let route=null,fin=0,done=null,err=null;
  for await(const e of O.runMultiAgent({strategy:"auto",userInput:q,councilSize:3})){
    if(e.type==="route")route=e; if(e.type==="final")fin=(e.content||"").length; if(e.type==="done")done=e; if(e.type==="error")err=e.message;
  }
  console.log(`[${label}] ${route?.classification}->${route?.resolved} | clf=${route?.classifier?.model} | chars=${fin} cost=$${done?.totalCostUsd?.toFixed(5)} ${err?"ERR:"+err:""}`);
  return route?.resolved;
}
(async()=>{
  const r=[];
  r.push(await run("FACT","What is the capital of Australia?")); await sleep(3000);
  r.push(await run("FACT","Convert 5 kilometers to miles.")); await sleep(3000);
  r.push(await run("OPEN","Compare buying vs building software for an early startup and recommend.")); await sleep(3000);
  r.push(await run("OPEN","Write a 4-line thank-you note to a mentor.")); await sleep(3000);
  r.push(await run("OPEN","Give the strongest argument for and against a four-day work week, then a verdict."));
  console.log("\nresults:",r.join(", "));
  console.log((r[0]==="single"&&r[1]==="single"&&r[2]==="council"&&r[3]==="council"&&r[4]==="council")?"LIVE_ROUTING_PASS":"MISMATCH");
})().catch(e=>{console.error(e.message);process.exit(1)});
