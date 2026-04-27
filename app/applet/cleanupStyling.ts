import * as fs from 'fs';
import * as path from 'path';

const p = path.join(process.cwd(), 'src/components/Profile.tsx');
let content = fs.readFileSync(p, 'utf-8');

content = content.replace(/overflow-hidden overflow-hidden/g, "overflow-hidden");
content = content.replace(/bg-white p-6 rounded-3xl border border-slate-200 shadow-sm/g, "bg-white p-6 rounded-[2rem] border border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.05)] bg-gradient-to-b from-white to-slate-50/30");
content = content.replace(/bg-white p-8 rounded-3xl border border-slate-200/g, "bg-white p-8 rounded-[2rem] border border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.05)] bg-gradient-to-b from-white to-slate-50/30");

// Let's also update the "bg-white rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" (Modals)
content = content.replace(/bg-white rounded-3xl/g, "bg-white rounded-[2rem]");


fs.writeFileSync(p, content);
console.log("Cleaned up styling");
