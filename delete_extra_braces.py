with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = f.readlines()

out = []
for i, line in enumerate(lines):
    if i < 6121:
        out.append(line)

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.writelines(out)

