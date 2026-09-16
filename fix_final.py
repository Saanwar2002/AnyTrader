with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

lines.insert(5747, "      });")
lines.insert(5785, "      });") # because 5747 shifted it down by 1

# Check if there is a missing closing brace at the end of the file
# We just add one `}` to the end of the file
lines.append("}")

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write('\n'.join(lines))
