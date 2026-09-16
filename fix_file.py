with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    out = [l.strip('\n') for l in f.readlines()]

final_out = []
i = 0
while i < len(out):
    line = out[i]
    final_out.append(line)
    if "processAICandidateToCanonical(" in line and "{" in line:
        k = i + 1
        found_close = False
        insert_idx = k
        while k < len(out) and k < i + 10:
            if out[k].strip() == "});" or out[k].strip() == "} as any)":
                found_close = True
                break
            if "expect(" in out[k] or out[k].strip() == "":
                insert_idx = k
                break
            k += 1
            
        if not found_close:
            # We need to insert `      });` at insert_idx.
            # But wait, final_out already has `line`.
            # We can just let the loop continue and insert it when `i == insert_idx`.
            pass

    i += 1

# Let's do it simpler.
final2 = []
i = 0
while i < len(out):
    line = out[i]
    final2.append(line)
    if "processAICandidateToCanonical(" in line and "{" in line:
        k = i + 1
        found_close = False
        while k < len(out) and k < i + 10:
            if out[k].strip() == "});" or out[k].strip() == "} as any)":
                found_close = True
                break
            if "expect(" in out[k]:
                break
            k += 1
            
        if not found_close:
            # Insert before the line containing expect, or the first empty line after properties
            # Actually just insert it immediately after the properties.
            # Find the last property line.
            last_prop = i
            for j in range(i+1, i+10):
                if "expect(" in out[j] or out[j].strip() == "":
                    last_prop = j - 1
                    break
            # insert after last_prop
            pass # this is getting complicated, let's just do it directly

