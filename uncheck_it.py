with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
i = 0
while i < len(lines):
    line = lines[i]
    if line == "    });":
        # check if previous non-empty line ends with } but not });
        prev_idx = len(out) - 1
        while prev_idx >= 0 and out[prev_idx].strip() == "":
            prev_idx -= 1
        
        if prev_idx >= 0 and out[prev_idx].strip().endswith("}") and not out[prev_idx].strip().endswith("});") and not out[prev_idx].strip() == "}":
            # wait, if prev_idx was just `    }`
            if out[prev_idx] == "    }":
                # we inserted this!
                i += 1
                continue
                
    out.append(line)
    i += 1
    
with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write('\n'.join(out))
