import os

def update_html_files():
    target_string = 'href="#" class="nav-link" id="nav-inventory"'
    replacement_string = 'href="inventory.html" class="nav-link" id="nav-inventory"'
    
    analytics_target = 'href="alerts.html?tab=reports" class="nav-link" id="nav-reports"'
    analytics_replacement = 'href="analytics.html" class="nav-link" id="nav-reports"'

    for filename in os.listdir('.'):
        if filename.endswith('.html'):
            with open(filename, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content.replace(target_string, replacement_string)
            new_content = new_content.replace(analytics_target, analytics_replacement)
            
            if new_content != content:
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {filename}")

if __name__ == "__main__":
    update_html_files()
