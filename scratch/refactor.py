import re
import os

files = {
    'dashboard.html': 'section-dashboard',
    'alerts.html': 'section-alerts',
    'camera.html': 'section-camera',
    'uploads.html': 'section-upload'
}

def clean_html(filepath, target_id):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the <main class="main-content" id="main-content">
    # and we want to keep only the section with target_id.
    # The others we delete.
    
    # We can use regex to find all <section class="tab-section"...>...</section>
    # and remove the ones that don't match target_id.
    
    # Actually, simpler: split by '<section class="tab-section'
    parts = content.split('<section class="tab-section')
    
    new_parts = [parts[0]]
    for part in parts[1:]:
        if f'id="{target_id}"' in part or f"id='{target_id}'" in part:
            # remove 'active' from class if it's there
            part = part.replace('active"', '"', 1).replace("active'", "'", 1)
            # wait, it split by '<section class="tab-section', so we need to add it back
            # but maybe we should just make it active? Wait, if we are in separate files, it doesn't need to be a tab-section anymore, or it can be but just one.
            # let's just keep the active one.
            new_parts.append('<section class="tab-section active"' + part)
        else:
            # this section is not the target.
            # However, the split by '<section class="tab-section' means this part goes up to the next section or end of main.
            # but wait, parts might contain </section> followed by other stuff.
            # No, parts[i] contains everything until the next <section...
            # so if we skip it, we lose the </section> and whatever is after it before the next section.
            # This is risky. Let's use regex.
            pass
            
    # Safer approach with regex:
    # Match <section class="tab-section".*?</section> (dotall)
    def replacer(match):
        text = match.group(0)
        if f'id="{target_id}"' in text or f"id='{target_id}'" in text:
            # ensure it has 'active'
            if 'active' not in text.split('id=')[0]:
                 text = text.replace('class="tab-section"', 'class="tab-section active"')
            return text
        return ""
        
    cleaned_content = re.sub(r'<section class="tab-section".*?</section>', replacer, content, flags=re.DOTALL)
    
    # Also clean up the external scripts at the bottom.
    # The user gave specific instructions:
    '''
    <!-- 1. Firebase CDN (always first) -->
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-storage-compat.js"></script>

    <!-- 2. Core (same on every page) -->
    <script src="js/core/firebase-config.js"></script>
    <script src="js/core/utils.js"></script>
    <script src="js/core/auth.js"></script>
    <script src="js/core/firestore-store.js"></script>

    <!-- 3. Page-specific (only what that page needs) -->
    <script src="js/pages/dashboard.js"></script>
    '''
    
    script_block = f"""  <!-- ═══════════════════════════════════════════════════════
     EXTERNAL SCRIPTS
  ═══════════════════════════════════════════════════════ -->
  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"></script>

  <!-- 1. Firebase CDN (always first) -->
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
"""
    if target_id == 'section-camera':
        script_block += '  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-storage-compat.js"></script>\n'
        
    script_block += """
  <!-- 2. Core (same on every page) -->
  <script src="js/core/firebase-config.js"></script>
  <script src="js/core/utils.js"></script>
  <script src="js/core/auth.js"></script>
  <script src="js/core/firestore-store.js"></script>

  <!-- 3. Page-specific (only what that page needs) -->
"""
    if target_id == 'section-dashboard':
        script_block += '  <script src="js/pages/dashboard.js"></script>\n'
    elif target_id == 'section-alerts':
        script_block += '  <script src="js/pages/alerts.js"></script>\n'
    elif target_id == 'section-camera':
        script_block += '  <script src="js/pages/camera.js"></script>\n'
    elif target_id == 'section-upload':
        script_block += '  <script src="js/pages/uploads.js"></script>\n'
        
    script_block += "</body>"
    
    cleaned_content = re.sub(r'<!-- ═══════════════════════════════════════════════════════\s*EXTERNAL SCRIPTS.*</body>', script_block, cleaned_content, flags=re.DOTALL)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(cleaned_content)

for filename, target in files.items():
    clean_html(filename, target)
