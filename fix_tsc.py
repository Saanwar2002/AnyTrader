with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

def insert_brace(start_line):
    # Find the next line that is `expect(` or `const ` or starts with less indentation
    for i in range(start_line, start_line + 15):
        if "expect(" in lines[i] or lines[i].strip() == "":
            lines.insert(i, "      });")
            return

insert_brace(3467)
insert_brace(3670)
insert_brace(3679) # Wait, 3679? Let's check 3679.
insert_brace(5711)
insert_brace(5751)
insert_brace(5951)

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write('\n'.join(lines))
