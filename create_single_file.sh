#!/bin/bash

# Find the actual CSS and JS files (they change with each build)
CSS_FILE=$(ls build/static/css/main.*.css 2>/dev/null | head -1)
JS_FILE=$(ls build/static/js/main.*.js 2>/dev/null | grep -v '.map' | grep -v 'LICENSE' | head -1)

if [ -z "$CSS_FILE" ] || [ -z "$JS_FILE" ]; then
  echo "Error: Build files not found. Run 'npm run build' first."
  exit 1
fi

echo "Using CSS: $CSS_FILE"
echo "Using JS: $JS_FILE"

# Extract filenames
CSS_NAME=$(basename "$CSS_FILE")
JS_NAME=$(basename "$JS_FILE")

# Create a Python script to do the replacement
cat > /tmp/create_single_html.py << 'PYTHON_SCRIPT'
import sys

html_file = sys.argv[1]
css_file = sys.argv[2]
js_file = sys.argv[3]
css_name = sys.argv[4]
js_name = sys.argv[5]

with open(html_file, 'r') as f:
    html = f.read()

with open(css_file, 'r') as f:
    css = f.read()

with open(js_file, 'r') as f:
    js = f.read()

# Replace CSS link
html = html.replace(f'<link href="/static/css/{css_name}" rel="stylesheet">', f'<style>{css}</style>')

# Replace JS script
html = html.replace(f'<script defer="defer" src="/static/js/{js_name}"></script>', f'<script>{js}</script>')

print(html)
PYTHON_SCRIPT

# Run Python script and save output
python3 /tmp/create_single_html.py build/index.html "$CSS_FILE" "$JS_FILE" "$CSS_NAME" "$JS_NAME" > md.html

# Clean up
rm /tmp/create_single_html.py

echo "Single file created: md.html"
echo "File size: $(wc -c < md.html | xargs) bytes"
