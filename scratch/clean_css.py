import os
import re

css_pages = [
    'landing.css', 'dashboard.css', 'herd.css', 
    'alerts.css', 'camera.css', 'uploads.css', 'profile.css'
]

# Create missing CSS files
for page in css_pages:
    filepath = os.path.join('css', 'pages', page)
    if not os.path.exists(filepath):
        header = f"""/* ============================================
   KisanTrack — {page}
   Purpose: Specific styles for {page.replace('.css', '.html')}
   Used by: {page.replace('.css', '.html')}
   ============================================ */
"""
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(header)

def add_header(filepath, content):
    filename = os.path.basename(filepath)
    used_by = filename.replace('.css', '.html') if 'pages' in filepath else 'Multiple pages'
    header = f"""/* ============================================
   KisanTrack — {filename}
   Purpose: Styles for {filename}
   Used by: {used_by}
   ============================================ */\n"""
    # Remove existing header comment if there is one
    if content.startswith('/* ='):
        content = re.sub(r'^/\* ===.*?\*/\s*', '', content, flags=re.DOTALL)
    elif content.startswith('/*'):
        content = re.sub(r'^/\*.*?\*/\s*', '', content, flags=re.DOTALL)
    return header + content

# Clean all CSS files
css_files = []
for root, dirs, files in os.walk('css'):
    for file in files:
        if file.endswith('.css'):
            css_files.append(os.path.join(root, file))

for filepath in css_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # The user asked to remove hardcoded colors and replace with vars
    # example: #7CB518 -> var(--accent-green)
    content = content.replace('#7CB518', 'var(--accent-green)')
    content = content.replace('#7cb518', 'var(--accent-green)')
    content = content.replace('#C0392B', 'var(--accent-red)')
    content = content.replace('#c0392b', 'var(--accent-red)')
    content = content.replace('#E5A100', 'var(--accent-amber)')
    content = content.replace('#e5a100', 'var(--accent-amber)')
    
    # Remove empty rule sets (e.g. .class { } or .class {\n})
    # This regex looks for selector { whitespace }
    content = re.sub(r'^[^{}]*\{\s*\}', '', content, flags=re.MULTILINE)
    
    # Add headers
    content = add_header(filepath, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
