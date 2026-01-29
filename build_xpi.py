import zipfile
import os

files_to_zip = [
    'background.js',
    'config.js',
    'index.html',
    'manifest.json',
    'popup.js',
    'style.css'
]

icon_dir = 'icons'
output_filename = 'tabins.xpi'

if os.path.exists(output_filename):
    os.remove(output_filename)

with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as xpi:
    # Add root files
    for file in files_to_zip:
        if os.path.exists(file):
            print(f"Adding {file}...")
            xpi.write(file, arcname=file)
    
    # Add icons
    if os.path.exists(icon_dir):
        for root, dirs, files in os.walk(icon_dir):
            for file in files:
                file_path = os.path.join(root, file)
                # Force forward slashes for the archive internal path
                archive_name = os.path.relpath(file_path, os.getcwd()).replace('\\', '/')
                print(f"Adding {archive_name}...")
                xpi.write(file_path, arcname=archive_name)

print(f"\nSuccessfully created {output_filename}")
