with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if 'it(' in line:
        # scan forward until next 'it(' or 'describe(' or '});'
        found_close = False
        for j in range(idx + 1, min(idx + 100, len(lines))):
            next_line = lines[j]
            if 'it(' in next_line or 'describe(' in next_line:
                break
            if '});' in next_line or '  });' in next_line:
                found_close = True
                break
        if not found_close:
            print(f"it on line {idx+1} might be missing close: {line.strip()}")
