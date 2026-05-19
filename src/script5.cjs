const fs = require('fs');
const file = 'src/components/driver/DriverJobs.tsx';
let content = fs.readFileSync(file, 'utf8');

// Ensure doc is imported
if (!content.includes('doc,')) {
    content = content.replace(/collection, query, where, orderBy, onSnapshot/g, 'collection, query, where, orderBy, onSnapshot, doc');
}

// Add state for fareConfig
content = content.replace(/const \[jobs, setJobs\] = useState<any\[\]>\(\[\]\);/g, `const [jobs, setJobs] = useState<any[]>([]);\n  const [fareConfig, setFareConfig] = useState({ commissionRate: 0.12, fixedTripFee: 0 });`);

// Add onSnapshot for fareConfig in useEffect
const useEffectStr = `useEffect(() => {
    if (!user) return;`;

const newUseEffectStr = `useEffect(() => {
    const globalQ = doc(db, "platform_config", "rides");
    const unsubGlobal = onSnapshot(globalQ, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFareConfig({
          commissionRate: data.commission ? Number(data.commission) / 100 : 0.12,
          fixedTripFee: data.fixedTripFee ? Number(data.fixedTripFee) : 0
        });
      }
    });

    if (!user) return;`;
content = content.replace(useEffectStr, newUseEffectStr);

// Also need to cleanup the global unsub, but we have return () => unsub(); at the end
content = content.replace(/return \(\) => unsub\(\);/g, 'return () => { unsub(); unsubGlobal(); };');

// Update computation lines
// (job.finalFare ? (job.finalFare - (job.tipAmount || 0)) * 0.88 + (job.tipAmount || 0) : driverEarnings + (job.tipAmount || 0)).toFixed(2)
content = content.replace(/\* 0\.88/g, '* (1 - fareConfig.commissionRate) - (fareConfig.fixedTripFee || 0)');

fs.writeFileSync(file, content);
console.log('Done!');
