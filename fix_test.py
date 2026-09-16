import re

def fix():
    with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
        content = f.read()

    # We will find all `it('...', async () => { ... })` blocks.
    # regex to match `it(..., async () => { ... });`
    # We can use a simpler approach: just find `const adminDb = testEnv!.authenticatedContext(..., { admin: true }).firestore();`
    # and replace it with `await withAdminDb(async (adminDb) => { ...`
    
    # Actually, the block can be found by matching `it(` until the end of the block.
    # Since regex for nested braces is hard, let's process line by line.

    lines = content.split('\n')
    new_lines = []
    
    in_it_block = False
    it_block_lines = []
    
    def process_it_block(block):
        block_str = '\n'.join(block)
        if 'testEnv!.authenticatedContext' in block_str and '{ admin: true }' in block_str and 'assertFails' not in block_str:
            # We need to wrap it.
            # Find the first line with testEnv!.authenticatedContext
            insert_idx = -1
            indent = ""
            for i, line in enumerate(block):
                if 'const adminCtx = testEnv!.authenticatedContext' in line and '{ admin: true }' in line:
                    insert_idx = i
                    indent = re.match(r'^\s*', line).group(0)
                    break
                elif 'const adminDb = testEnv!.authenticatedContext' in line and '{ admin: true }' in line:
                    insert_idx = i
                    indent = re.match(r'^\s*', line).group(0)
                    break
                elif 'const adminCtx1 =' in line:
                    insert_idx = i
                    indent = re.match(r'^\s*', line).group(0)
                    break
            
            if insert_idx != -1:
                # Remove the original lines that define adminCtx/adminDb
                filtered_block = []
                for j in range(len(block)):
                    line = block[j]
                    if 'const adminCtx = testEnv!.authenticatedContext' in line:
                        continue
                    if 'const adminDb = adminCtx.firestore();' in line:
                        continue
                    if 'const adminDb = testEnv!.authenticatedContext' in line:
                        continue
                    if 'const adminCtx1 =' in line:
                        continue
                    if 'const adminCtx2 =' in line:
                        continue
                    filtered_block.append(line)
                
                # Now wrap everything from insert_idx to the end of the block (excluding the last `});`)
                top_part = filtered_block[:insert_idx]
                bottom_part = filtered_block[insert_idx:-1]
                end_line = filtered_block[-1] # This is `    });`
                
                wrapped_bottom = [indent + "await withAdminDb(async (adminDb) => {"]
                if "adminCtx" in block_str:
                    wrapped_bottom.append(indent + "  const adminCtx = { firestore: () => adminDb };")
                if "adminCtx1" in block_str:
                    wrapped_bottom.append(indent + "  const adminCtx1 = { firestore: () => adminDb };")
                if "adminCtx2" in block_str:
                    wrapped_bottom.append(indent + "  const adminCtx2 = { firestore: () => adminDb };")
                    
                for line in bottom_part:
                    wrapped_bottom.append("  " + line if line.strip() else line)
                wrapped_bottom.append(indent + "});")
                
                return top_part + wrapped_bottom + [end_line]
        
        return block

    for line in lines:
        if re.match(r'^\s*it\(', line):
            if in_it_block:
                # shouldn't happen unless nested, which it shouldn't be
                new_lines.extend(it_block_lines)
            in_it_block = True
            it_block_lines = [line]
        elif in_it_block:
            it_block_lines.append(line)
            if re.match(r'^\s*\}\);?\s*$', line):
                # end of it block
                in_it_block = False
                processed = process_it_block(it_block_lines)
                new_lines.extend(processed)
                it_block_lines = []
        else:
            new_lines.append(line)
            
    with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
        f.write('\n'.join(new_lines))
        
fix()
