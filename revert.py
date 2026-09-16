import re

def revert():
    with open('restore_lines.txt', 'r') as f:
        restore_lines = [l.strip('\n') for l in f.readlines()]
    
    with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
        lines = [l.strip('\n') for l in f.readlines()]
        
    out_lines = []
    
    # We will process line by line.
    i = 0
    restore_idx = 0
    
    while i < len(lines):
        line = lines[i]
        
        if "await withAdminDb(async (adminDb) => {" in line:
            # Check if it was inserted by us by checking the next lines
            next_line = lines[i+1]
            if "const adminCtx = { firestore:" in next_line or "const adminCtx1 = { firestore:" in next_line or "const adminCtx2 = { firestore:" in next_line or "const adminDb = testEnv!" in restore_lines[restore_idx]:
                # It was inserted by us!
                indent = re.match(r'^\s*', line).group(0)
                
                # We need to insert the restored line instead!
                # Wait! What if there are multiple adminCtx (like adminCtx1 and adminCtx2) in the SAME block?
                # My previous script wrapped the whole block ONCE, and inserted BOTH adminCtx1 and adminCtx2.
                # So we might need to consume MULTIPLE restore lines if there were multiple in the same block!
                
                # Let's count how many adminCtx mock lines we have:
                mock_count = 0
                j = i + 1
                while "const adminCtx" in lines[j] and "{ firestore:" in lines[j]:
                    mock_count += 1
                    j += 1
                
                # What if there were NO mock lines? (Because the original just assigned to adminDb)
                if mock_count == 0:
                    mock_count = 1 # One restore line (the adminDb one)
                    
                # Pop the restore lines
                for _ in range(mock_count):
                    # We just use the raw string from restore_lines (it includes line numbers, so we strip them)
                    orig_line = restore_lines[restore_idx]
                    orig_line = orig_line.split(":", 1)[1] # remove line number
                    out_lines.append(orig_line) # keep original indentation, or strip and add current?
                    # The grep output has original indentation! Wait, grep output is `3289:      const ...`
                    # So orig_line has the exact original indentation!
                    restore_idx += 1
                
                # Skip the lines that my script inserted
                i = j - 1 # i will be incremented at the end of the loop
                
                # Now we need to find the `});` that was inserted at the end of this block.
                # Since my script inserted it just before the `end_line` of the `it` block,
                # we can look ahead for the next `it(` or end of file, and find the LAST `indent + "});"` before it.
                # Actually, my script did: `wrapped_bottom.append(indent + "});")`
                # So we can look for `indent + "});"` and remove it.
                # BUT wait! If there are nested callbacks, there might be other `indent + "});"`.
                # We should find the LAST one before the `end_line` (which is `    });` but maybe different indent).
                # To be safe, let's find the `it` block end.
                k = i + 1
                it_block_end = k
                while k < len(lines) and not re.match(r'^\s*it\(', lines[k]) and not re.match(r'^\s*describe\(', lines[k]):
                    it_block_end = k
                    k += 1
                    
                # Look backwards from it_block_end for `indent + "});"`
                found_close = False
                for k_rev in range(it_block_end, i, -1):
                    if lines[k_rev] == indent + "});":
                        # Mark this line to be deleted
                        lines[k_rev] = "DELETE_ME"
                        found_close = True
                        break
                
                if not found_close:
                    print("WARNING: Could not find closing brace for indent", repr(indent), "at line", i)
                    
            else:
                out_lines.append(line)
        elif line == "DELETE_ME":
            pass
        else:
            out_lines.append(line)
            
        i += 1

    with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
        f.write('\n'.join(out_lines))
        
revert()
