import re

with open('restore_lines.txt', 'r') as f:
    restore_lines = [l.strip('\n') for l in f.readlines()]

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
i = 0
restore_idx = 0

while i < len(lines):
    line = lines[i]
    if "await withAdminDb(async (adminDb) => {" in line:
        # Determine how many mock lines to skip
        mock_count = 0
        j = i + 1
        while j < len(lines) and ("const adminCtx" in lines[j] and "{ firestore:" in lines[j]):
            mock_count += 1
            j += 1
            
        if mock_count == 0:
            mock_count = 1
            
        # Insert restored lines
        for _ in range(mock_count):
            if restore_idx < len(restore_lines):
                orig = restore_lines[restore_idx].split(":", 1)[1]
                out.append(orig)
                restore_idx += 1
                
        i = j
        
        # Now we are inside the first half.
        # We need to un-indent lines by 2 spaces until we hit `});});` or `      });` which closes the early block.
        # Wait, for line 3436, I already deleted `});});`.
        # So we just unindent until we see a line that is NOT indented by 2 extra spaces, OR we see a function call like `const storeDb =`.
        # Actually, let's just unindent everything that has 8 spaces or more, until we hit a line with 6 spaces (like `const storeDb`).
        while i < len(lines):
            line = lines[i]
            if "});});" in line:
                # Delete this line! It is the corrupted close.
                i += 1
                break
            
            # Check for the early close `      });` if `});});` was already deleted.
            if line == "      });" and (i+1 < len(lines) and "const storeDb =" in lines[i+1]):
                # This is the early close from the first script!
                i += 1
                break
            elif line == "      });" and (i+1 < len(lines) and "const res1 =" in lines[i+1]):
                i += 1
                break
                
            # If we hit `const storeDb =` or something with 6 spaces that is not `});`, we probably reached the second half.
            if line.startswith("      const storeDb =") or line.startswith("      const rawCandidate =") or line.startswith("      const res1 ="):
                break
                
            # Unindent
            if line.startswith("  "):
                out.append(line[2:])
            else:
                out.append(line)
                
            i += 1
            
        continue

    # Fix processAICandidateToCanonical missing brace
    if "processAICandidateToCanonical(" in line and "{" in line:
        out.append(line)
        # Check if the next few lines contain the closing brace
        # Usually it's `firestoreDb: storeDb,` then `persistToStore: true,` then `});`
        # But `revert.py` deleted `});` if it was exactly `      });`.
        # Let's scan forward.
        k = i + 1
        found_close = False
        while k < len(lines) and k < i + 10:
            if lines[k].strip() == "});":
                found_close = True
                break
            if "expect(" in lines[k]:
                break
            k += 1
            
        if not found_close:
            # We need to insert it before the first `expect(` or `const `
            # But wait, we can just insert it as we process.
            # We will set a flag to insert it.
            pass
            
    out.append(line)
    i += 1

# Second pass for processAICandidateToCanonical
final_out = []
i = 0
while i < len(out):
    line = out[i]
    final_out.append(line)
    if "processAICandidateToCanonical(" in line and "{" in line:
        # Check if it has `});`
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
            final_out.insert(len(final_out)-1 + (insert_idx - i), "      });")
            
    i += 1

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write('\n'.join(out))

