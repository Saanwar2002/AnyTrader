import re

def fix():
    with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
        content = f.read()

    # We want to find `it('...', async () => {`
    # and find where it ends.
    # Then if it contains `admin: true` and NOT `assertFails` (or other negative checks), we wrap its content.

    # regex to find `it(`
    # We will iterate through the string.
    
    out = ""
    idx = 0
    
    while idx < len(content):
        # find next `it('` or `it("` or `it(`
        match = re.search(r'\n\s*it\([\'"`].*?[\'"`],\s*async\s*\(\)\s*=>\s*\{', content[idx:])
        if not match:
            out += content[idx:]
            break
            
        start_idx = idx + match.start()
        body_start = idx + match.end()
        
        out += content[idx:body_start]
        
        # Now find the matching closing brace for `body_start - 1`
        depth = 1
        curr = body_start
        
        in_string = False
        string_char = None
        in_escape = False
        
        while curr < len(content) and depth > 0:
            c = content[curr]
            if in_escape:
                in_escape = False
            elif c == '\\':
                in_escape = True
            elif in_string:
                if c == string_char:
                    in_string = False
            elif c in "'\"`":
                in_string = True
                string_char = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                
            curr += 1
            
        body_end = curr - 1 # The '}' character
        
        body_content = content[body_start:body_end]
        
        # Check if we should wrap this body
        if 'testEnv!.authenticatedContext' in body_content and '{ admin: true }' in body_content and 'assertFails' not in body_content:
            # We need to wrap.
            # But wait, we need to replace the `const adminCtx = ...` lines.
            
            # Let's process the body_content line by line.
            lines = body_content.split('\n')
            new_lines = []
            
            indent = re.match(r'\n(\s*)it', content[idx+match.start():]).group(1)
            body_indent = indent + "  "
            
            inserted = False
            for line in lines:
                if 'const adminCtx = testEnv!.authenticatedContext' in line and '{ admin: true }' in line:
                    if not inserted:
                        new_lines.append(body_indent + "await withAdminDb(async (adminDb) => {")
                        inserted = True
                    new_lines.append(body_indent + "  const adminCtx = { firestore: () => adminDb };")
                elif 'const adminDb = testEnv!.authenticatedContext' in line and '{ admin: true }' in line:
                    if not inserted:
                        new_lines.append(body_indent + "await withAdminDb(async (adminDb) => {")
                        inserted = True
                elif 'const adminCtx1 = testEnv!.authenticatedContext' in line and '{ admin: true }' in line:
                    if not inserted:
                        new_lines.append(body_indent + "await withAdminDb(async (adminDb) => {")
                        inserted = True
                    new_lines.append(body_indent + "  const adminCtx1 = { firestore: () => adminDb };")
                elif 'const adminCtx2 = testEnv!.authenticatedContext' in line and '{ admin: true }' in line:
                    if not inserted:
                        new_lines.append(body_indent + "await withAdminDb(async (adminDb) => {")
                        inserted = True
                    new_lines.append(body_indent + "  const adminCtx2 = { firestore: () => adminDb };")
                elif 'const adminDb = adminCtx.firestore();' in line:
                    pass # removed
                else:
                    if inserted:
                        # Add extra indentation
                        if line.strip() == "":
                            new_lines.append(line)
                        else:
                            new_lines.append("  " + line)
                    else:
                        new_lines.append(line)
                        
            if inserted:
                new_lines.append(body_indent + "});")
                
            out += '\n'.join(new_lines)
        else:
            out += body_content
            
        out += content[body_end:curr] # the `}`
        idx = curr

    with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
        f.write(out)

fix()
