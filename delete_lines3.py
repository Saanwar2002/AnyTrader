import re
with open('/tmp/bad_lines2.txt', 'r') as f:
    err_lines = f.readlines()

lines_to_delete = []
for el in err_lines:
    m = re.search(r'\((\d+),\d+\)', el)
    if m:
        lines_to_delete.append(int(m.group(1)))

lines_to_delete = sorted(list(set(lines_to_delete)))

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
for i, line in enumerate(lines):
    if i + 1 not in lines_to_delete:
        out.append(line)

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write('\n'.join(out))
