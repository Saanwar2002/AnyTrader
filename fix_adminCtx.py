with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
i = 0
while i < len(lines):
    line = lines[i]
    if "const adminCtx = { firestore: () => adminDb };" in line:
        # skip it
        # also if the previous line was empty and we already added it, we could remove it, but it's fine.
        i += 1
        continue
        
    if "const adminCtx = testEnv!.authenticatedContext('admin_emu_t14c_tg', { admin: true });" in line:
        # duplicate
        if i > 0 and lines[i-1] == line:
            i += 1
            continue
            
    out.append(line)
    i += 1

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write('\n'.join(out))
