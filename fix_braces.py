import re

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
for i, line in enumerate(lines):
    if line == "    });" and i + 1 < len(lines):
        next_line = lines[i+1].strip()
        if next_line.startswith("describe(") or next_line.startswith("it("):
            continue # drop it
    out.append(line)

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write('\n'.join(out))
