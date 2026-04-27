import * as fs from 'fs';
import * as path from 'path';

const p = path.join(process.cwd(), 'src/components/Profile.tsx');
let content = fs.readFileSync(p, 'utf-8');

// The current string is: bg-white rounded-3xl border-2 border-slate-200 shadow-md shadow-slate-200/50
// The user says it looks plain and white, wants dark shadows edges.
const target = "bg-white rounded-3xl border-2 border-slate-200 shadow-md shadow-slate-200/50";
const replacement = "bg-white rounded-[2rem] border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-gradient-to-b from-white to-slate-50/50 overflow-hidden";

content = content.split(target).join(replacement);

fs.writeFileSync(p, content);
console.log("Replaced successfully: " + (content.includes(replacement)));
