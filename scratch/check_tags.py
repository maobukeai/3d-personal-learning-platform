import re
import subprocess

# Get the HEAD version of the file
try:
    content = subprocess.check_output(
        ["git", "show", "HEAD:src/views/Admin/AdminMirrorView.vue"],
        cwd=r"c:\Users\20269\Desktop\3d-personal-learning-platform"
    ).decode("utf-8")
except Exception as e:
    print(f"Error calling git show: {e}")
    exit()

template_pos = content.find("<template>")
template_content = content[template_pos:]

# Remove HTML comments
template_content = re.sub(r"<!--.*?-->", "", template_content, flags=re.DOTALL)

# Let's count <div ...> and </div>
div_opens = len(re.findall(r"<div(?:\s+[^>]*?)?>", template_content, re.IGNORECASE))
div_closes = len(re.findall(r"</div>", template_content, re.IGNORECASE))

print(f"HEAD Opening <div> count: {div_opens}")
print(f"HEAD Closing </div> count: {div_closes}")
print(f"HEAD Balance (Opens - Closes): {div_opens - div_closes}")
