import os
import re

admin_dir = r"c:\Users\20269\Desktop\3d-personal-learning-platform\src\views\Admin"
files = [f for f in os.listdir(admin_dir) if f.endswith('.vue')]

for filename in files:
    filepath = os.path.join(admin_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print(f"=== {filename} ({len(content)} bytes) ===")
    
    # Check for header
    headers = re.findall(r'<h[1-6][^>]*>.*?</h[1-6]>', content, re.IGNORECASE)
    print(f"  Headers found: {len(headers)}")
    for h in headers[:3]:
        print(f"    {h.strip()}")
        
    # Check for stats / cards
    stats_indicators = ["stats", "total", "count", "pending", "cards"]
    stats_found = [ind for ind in stats_indicators if ind in content.lower()]
    print(f"  Keywords: {stats_found}")
    
    # Check if there is an ElTable or a list grid
    has_el_table = "el-table" in content.lower()
    has_grid = "grid-cols" in content.lower()
    print(f"  ElTable: {has_el_table}, Grid layout: {has_grid}")
    print()
