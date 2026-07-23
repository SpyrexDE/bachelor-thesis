import { readFileSync, existsSync } from "node:fs";
const done = new Set();
if (existsSync("./workflow_out.json"))
  for (const r of JSON.parse(readFileSync("./workflow_out.json","utf8")).results||[]) done.add(r.i);
const tasks = JSON.parse(readFileSync("./anchor_tasks.json","utf8"));
const missing = tasks.map((_,i)=>i).filter(i=>!done.has(i));
console.log(JSON.stringify(missing));
