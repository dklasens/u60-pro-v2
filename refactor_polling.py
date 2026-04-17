import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    pattern = re.compile(
        r'([ \t]*)useEffect\(\(\) => \{\s*'
        r'(?:([a-zA-Z0-9_]+)\(\);?)?\s*'
        r'(?:const\s+id\s*=\s*)?setInterval\(([a-zA-Z0-9_]+),\s*([0-9]+)\);?\s*'
        r'return\s*\(\)\s*=>\s*clearInterval\((?:id)?\);?\s*'
        r'\}, \[(.*?)\]\)',
        re.MULTILINE
    )
    
    def replacer(match):
        indent = match.group(1)
        if not indent or indent == '\n':
            indent = "  "
            
        initial_call = match.group(2)
        fn_name = match.group(3)
        delay = match.group(4)
        deps = match.group(5).strip()
        
        if "AdvancedPage.tsx" in filepath:
            delay_expr = "interval * 1000"
            if "interval" not in [d.strip() for d in deps.split(',')]:
                deps = deps + ", interval"
        else:
            delay_expr = delay
            
        inner_indent = indent + "  "
        
        replacement = f"""{indent}useEffect(() => {{
{inner_indent}let timeoutId: number | undefined
{inner_indent}let mounted = true
{inner_indent}let isFetching = false

{inner_indent}const loop = async () => {{
{inner_indent}  if (isFetching) return
{inner_indent}  isFetching = true
{inner_indent}  await {fn_name}()
{inner_indent}  isFetching = false
{inner_indent}  if (mounted) timeoutId = window.setTimeout(loop, {delay_expr})
{inner_indent}}}

{inner_indent}loop()
{inner_indent}return () => {{
{inner_indent}  mounted = false
{inner_indent}  if (timeoutId) clearTimeout(timeoutId)
{inner_indent}}}
{indent}}}, [{deps}])"""
        
        return replacement

    new_content, count = pattern.subn(replacer, content)
    
    if count > 0:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {count} occurrence(s) in {filepath}")

if __name__ == "__main__":
    target_files = ["dashboard/src/components/AlertBanner.tsx"]
    for root, _, files in os.walk("dashboard/src/pages"):
        for file in files:
            if file.endswith(".tsx"):
                target_files.append(os.path.join(root, file))

    for f in target_files:
        if os.path.exists(f):
            process_file(f)
        else:
            print(f"Warning: {f} not found.")
