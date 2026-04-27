import * as fs from 'fs';

const p = 'src/components/Profile.tsx';
let content = fs.readFileSync(p, 'utf-8');

content = content.replace(/bg-white rounded-3xl border border-slate-200 shadow-sm/g, "bg-white rounded-3xl border-2 border-slate-200 shadow-md shadow-slate-200/50");
content = content.replace(/bg-white rounded-3xl border border-slate-100 shadow-sm/g, "bg-white rounded-3xl border-2 border-slate-200 shadow-md shadow-slate-200/50");

fs.writeFileSync(p, content);
console.log("Updated borders");
