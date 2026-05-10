import os
import re

js_files = []
for root, dirs, files in os.walk('js'):
    for file in files:
        if file.endswith('.js'):
            js_files.append(os.path.join(root, file))

def add_header(filepath, content):
    filename = os.path.basename(filepath)
    header = f"""// ============================================
// KisanTrack — {filename}
// Purpose: Main logic for {filename}
// Page: Multiple
// Dependencies: Firebase
// Last Updated: 2026-05-09
// ============================================\n"""
    # Remove existing header comment if there is one
    if content.startswith('/**') or content.startswith('// =='):
        content = re.sub(r'^/\*\*.*?\*/\s*', '', content, flags=re.DOTALL)
        content = re.sub(r'^// ===.*?\n\s*', '', content, flags=re.DOTALL)
    return header + content

for filepath in js_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Clean console.log (but keep console.error)
    # Be careful not to remove multiline statements completely, just the console.log line
    content = re.sub(r'^[ \t]*console\.log\(.*?\);?\s*?\n', '', content, flags=re.MULTILINE)
    
    # Remove commented-out old code blocks (naively, remove // old code, /* deprecated */)
    content = re.sub(r'//\s*old code.*?\n', '', content, flags=re.IGNORECASE)
    content = re.sub(r'/\*\s*deprecated.*?\*/', '', content, flags=re.IGNORECASE | re.DOTALL)
    
    # Remove placeholder strings
    content = content.replace('"REPLACE_ME"', '""').replace("'REPLACE_ME'", "''")
    content = content.replace('"YOUR_UID_HERE"', '""').replace("'YOUR_UID_HERE'", "''")
    
    # Add headers
    content = add_header(filepath, content)
    
    # Special rules for firebase-config.js
    if 'firebase-config.js' in filepath:
        if 'NOTE: Firebase client config is safe to expose' not in content:
            # insert before const firebaseConfig =
            content = content.replace('const firebaseConfig', '// NOTE: Firebase client config is safe to expose\n// publicly. Security is enforced by Firestore Rules\n// and Firebase Auth, not by hiding this config.\n// Do NOT commit your Gemini API key here.\nconst firebaseConfig')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
