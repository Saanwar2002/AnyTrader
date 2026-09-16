import re

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
i = 0
while i < len(lines):
    line = lines[i]
    if "adminCtx = testEnv!.authenticatedContext" in line:
        if i+1 < len(lines) and "adminDb =" not in lines[i+1] and "firestore()" not in lines[i+1]:
            # Next line might be `const storeDb = createRealFirestoreStoreDb(adminDb);`
            # We need to insert `const adminDb = adminCtx.firestore();`
            if "const storeDb =" in lines[i+1] and "adminDb" in lines[i+1]:
                out.append(line)
                out.append("        const adminDb = adminCtx.firestore();")
                i += 1
                continue
    
    if "testEnv!.authenticatedContext" in line and "adminCtx =" not in line:
        pass
        
    out.append(line)
    i += 1

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write('\n'.join(out))
