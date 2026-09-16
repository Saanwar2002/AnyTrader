import re

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
for i, line in enumerate(lines):
    if line == "    });" and i == 121:
        continue
    if line == "  });" and i == 122:
        continue
    out.append(line)

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write('\n'.join(out))

