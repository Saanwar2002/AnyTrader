const fs = require('fs');
let code = fs.readFileSync('src/components/Profile.tsx', 'utf8');
code = code.replace(/const \{ user, profile(.*?)\} = useAuth\(\);/, (match) => {
  return match + "\n  const isBusinessProfile = profile?.role === 'business' || profile?.role === 'tradesperson';";
});
code = code.replace(/profile\.role === "tradesperson"/g, "isBusinessProfile");
fs.writeFileSync('src/components/Profile.tsx', code);
