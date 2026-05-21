import os
import re

admin_dir = r"c:\Users\20269\Desktop\3d-personal-learning-platform\src\views\Admin"
files = ["AdminCoursesView.vue", "AdminManualView.vue", "AdminMirrorView.vue", "AdminSubscriptionsView.vue", "UsersView.vue", "FeedbackView.vue"]

for filename in files:
    filepath = os.path.join(admin_dir, filename)
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print(f"========================================\nFILE: {filename}\n========================================")
    template_match = re.search(r'<template>([\s\S]*?)</template>', content)
    if template_match:
        template = template_match.group(1)
        # Get the first 150 lines of the template
        lines = template.split('\n')
        for i, line in enumerate(lines[:100]):
            print(f"{i+1:3d}: {line}")
    print("\n")
