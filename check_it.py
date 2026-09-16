with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
i = 0
while i < len(lines):
    line = lines[i]
    if line.startswith("    it('") or line.startswith("  describe('") or line == "  });":
        # Check previous line
        # First, find the previous non-empty line
        prev_idx = len(out) - 1
        while prev_idx >= 0 and out[prev_idx].strip() == "":
            prev_idx -= 1
            
        if prev_idx >= 0:
            prev_line = out[prev_idx]
            if not prev_line.endswith("});"):
                # Missing closing brace!
                # Insert it at the end of out
                out.append("    });")
    out.append(line)
    i += 1

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write('\n'.join(out))
