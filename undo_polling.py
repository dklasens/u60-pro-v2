import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    pattern = re.compile(
        r'([ \t]*)useEffect\(\(\) => \{\n'
        r'(?:[ \t]*let timeoutId: number \| undefined\n)'
        r'(?:[ \t]*let mounted = true\n)'
        r'(?:[ \t]*let isFetching = false\n)?\n*'
        r'(?:[ \t]*const loop = async \(\) => \{\n)'
        r'(?:[ \t]*if \(isFetching\) return\n)?'
        r'(?:[ \t]*isFetching = true\n)?'
        r'(?:[ \t]*await ([a-zA-Z0-9_]+)\(\)\n)'
        r'(?:[ \t]*isFetching = false\n)?'
        r'(?:[ \t]*if \(mounted\) timeoutId = window\.setTimeout\(loop, (.*?)\)\n)'
        r'(?:[ \t]*\}\n\n)'
        r'(?:[ \t]*loop\(\)\n)'
        r'(?:[ \t]*return \(\) => \{\n)'
        r'(?:[ \t]*mounted = false\n)'
        r'(?:[ \t]*if \(timeoutId\) clearTimeout\(timeoutId\)\n)'
        r'(?:[ \t]*\}\n)'
        r'(?:[ \t]*\}, \[(.*?)\]\))',
        re.MULTILINE
    )
    
    def replacer(match):
        indent = match.group(1)
        fn_name = match.group(2)
        delay_expr = match.group(3)
        deps = match.group(4)
        
        # reconstruct original
        delay_val = delay_expr.replace(" * 1000", "") # for AdvancedPage
        deps = deps.replace(", interval", "") # remove interval if it was added
        
        replacement = f"{indent}useEffect(() => {{\n{indent}  {fn_name}()\n{indent}  const id = setInterval({fn_name}, {delay_val})\n{indent}  return () => clearInterval(id)\n{indent}}}, [{deps}])"
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

