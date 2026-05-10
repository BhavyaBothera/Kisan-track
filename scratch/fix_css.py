import re
import os

html_files = [f for f in os.listdir('.') if f.endswith('.html')]

def clean_head(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    filename = os.path.basename(filepath)
    css_name = filename.replace('.html', '.css')
    
    # Generate the proper CSS block
    css_block = f"""  <!-- App Stylesheets -->
  <!-- 1. Global base (every page) -->
  <link rel="stylesheet" href="css/main.css" />
  <link rel="stylesheet" href="css/components.css" />
  <link rel="stylesheet" href="css/animations.css" />
"""
    if filename not in ['index.html', 'login.html']:
        css_block += '  <!-- 2. Sidebar (all pages EXCEPT index and login) -->\n'
        css_block += '  <link rel="stylesheet" href="css/sidebar.css" />\n'
        
    css_block += f'  <!-- 3. Page-specific (only that page\'s CSS) -->\n'
    if filename == 'index.html':
        css_block += f'  <link rel="stylesheet" href="css/pages/landing.css" />\n'
    elif filename == 'login.html':
        css_block += f'  <link rel="stylesheet" href="css/pages/auth.css" />\n'
    else:
        css_block += f'  <link rel="stylesheet" href="css/pages/{css_name}" />\n'
        
    css_block += "</head>"

    # Replace everything from <!-- App Stylesheets --> to </head>
    # Actually, we can just replace the whole head link section.
    # Let's match from <!-- App Stylesheets --> to </head>
    cleaned_content = re.sub(r'<!-- App Stylesheets -->.*?</head>', css_block, content, flags=re.DOTALL)
    
    # Also ensure meta tags:
    meta_tags = """  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="KisanTrack - Smart Livestock Monitoring" />
  <title>KisanTrack | Page</title>
"""
    # Just update the <title> tag
    page_name = filename.replace('.html', '').capitalize()
    if page_name == 'Index': page_name = 'Home'
    
    cleaned_content = re.sub(r'<title>.*?</title>', f'<title>KisanTrack | {page_name}</title>', cleaned_content, flags=re.DOTALL)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(cleaned_content)

for filename in html_files:
    clean_head(filename)
