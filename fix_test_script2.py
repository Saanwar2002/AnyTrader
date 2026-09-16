import re

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
i = 0
while i < len(lines):
    line = lines[i]
    if "const storeDb = createRealFirestoreStoreDb(adminDb);" in line:
        if "adminDb" in line and (i == 0 or "adminDb =" not in lines[i-1]):
            # If adminCtx exists in the few lines above, we can assume it's defined
            has_adminCtx = False
            for j in range(max(0, i-5), i):
                if "adminCtx =" in lines[j] or "adminCtx" in lines[j]:
                    has_adminCtx = True
                    break
            
            if has_adminCtx:
                out.append("        const adminDb = adminCtx.firestore();")
                out.append(line)
                i += 1
                continue
    out.append(line)
    i += 1

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write('\n'.join(out))
