with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
i = 0
while i < len(lines):
    line = lines[i]
    if "const result = await processAICandidateToCanonical(" in line:
        # Check if next line is identical
        if i + 1 < len(lines) and lines[i+1] == line:
            i += 1 # skip duplicate
            
    if "const res1 = await processAICandidateToCanonical(" in line:
        if i + 1 < len(lines) and lines[i+1] == line:
            i += 1
            
    if "const res2 = await processAICandidateToCanonical(" in line:
        if i + 1 < len(lines) and lines[i+1] == line:
            i += 1
            
    if "const firstWrite = await immutableIntelligenceStore.persistQualityReview({" in line:
        if i + 1 < len(lines) and lines[i+1] == line:
            i += 1
            
    if "const retryWrite = await immutableIntelligenceStore.persistQualityReview({" in line:
        if i + 1 < len(lines) and lines[i+1] == line:
            i += 1

    out.append(lines[i])
    i += 1

# Also find where `      });` was added incorrectly
# We want to remove extra `      });` that are in the middle of arguments.
# For example, line 3469 and 3470:
# 3468        firestoreDb: storeDb,
# 3469      });
# 3470        persistToStore: true,
# 3471      });
# We can just remove `      });` if the next line is `        persistToStore: true,`
final_out = []
i = 0
while i < len(out):
    line = out[i]
    if line == "      });" and i + 1 < len(out) and out[i+1].strip() == "persistToStore: true,":
        # skip this brace
        pass
    else:
        final_out.append(line)
    i += 1

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write('\n'.join(final_out))
