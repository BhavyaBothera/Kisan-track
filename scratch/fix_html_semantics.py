import os
import re

def fix_html(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add FOUC Style
    if '<style>html { visibility: hidden; }</style>' not in content:
        content = content.replace('</head>', '  <!-- FOUC Prevention -->\n  <style>html { visibility: hidden; }</style>\n</head>')

    # 2. Fix Sidebar Links
    # Pattern to find the nav links in the sidebar
    nav_pattern = r'<a (?:href=".*?" )?class="nav-link(.*?)" (?:data-tab=".*?" )?(?:role="button" )?(?:tabindex=".*?" )?id="(.*?)">'
    def sidebar_repl(match):
        active_class = match.group(1)
        nav_id = match.group(2)
        href_map = {
            'nav-dashboard': 'dashboard.html',
            'nav-animals': 'herd.html',
            'nav-vitals': 'herd.html?tab=vitals',
            'nav-camera': 'camera.html',
            'nav-alerts': 'alerts.html',
            'nav-reports': 'alerts.html?tab=reports',
            'nav-upload': 'uploads.html',
            'nav-profile': 'profile.html'
        }
        href = href_map.get(nav_id, '#')
        return f'<a href="{href}" class="nav-link{active_class}" id="{nav_id}">'
    
    content = re.sub(nav_pattern, sidebar_repl, content)
    
    # Ensure closing tags for sidebar links are </a> not </div>
    # This is tricky because there might be other divs. 
    # But usually the migrated files had a specific structure.
    # Actually, I'll just look for the specific block.
    
    # 3. Fix Mobile Nav
    mobile_pattern = r'<(?:div|a) class="mobile-nav-item(.*?)" (?:data-tab=".*?" )?id="(.*?)">'
    def mobile_repl(match):
        active_class = match.group(1)
        nav_id = match.group(2)
        href_map = {
            'mnav-dashboard': 'dashboard.html',
            'mnav-animals': 'herd.html',
            'mnav-vitals': 'herd.html?tab=vitals',
            'mnav-alerts': 'alerts.html',
            'mnav-camera': 'camera.html',
            'mnav-profile': 'profile.html'
        }
        href = href_map.get(nav_id, '#')
        return f'<a href="{href}" class="mobile-nav-item{active_class}" id="{nav_id}">'
    
    content = re.sub(mobile_pattern, mobile_repl, content)

    # 4. Global replacement for closing </div> that should be </a> inside navs
    # This is risky, but I'll limit it to the known patterns from my view_file
    content = content.replace('</span></span>\n      </div>', '</span></span>\n      </a>')
    content = content.replace('</span>\n      </div>', '</span>\n      </a>')
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

pages = ['dashboard.html', 'herd.html', 'alerts.html', 'camera.html', 'uploads.html', 'profile.html']
for page in pages:
    if os.path.exists(page):
        print(f"Fixing {page}...")
        fix_html(page)
