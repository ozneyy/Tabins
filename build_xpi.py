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
output_files = ['tabins.xpi', 'Tabins.zip']

def build_archive(filename):
    if os.path.exists(filename):
        os.remove(filename)

    with zipfile.ZipFile(filename, 'w', zipfile.ZIP_DEFLATED) as archive:
        # Add root files
        for file in files_to_zip:
            if os.path.exists(file):
                print(f"Adding {file} to {filename}...")
                archive.write(file, arcname=file)
        
        # Add icons
        if os.path.exists(icon_dir):
            for root, dirs, files in os.walk(icon_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    # Force forward slashes for the archive internal path
                    archive_name = os.path.relpath(file_path, os.getcwd()).replace('\\', '/')
                    print(f"Adding {archive_name} to {filename}...")
                    archive.write(file_path, arcname=archive_name)

    print(f"✅ Successfully created {filename}")

if __name__ == '__main__':
    for out in output_files:
        build_archive(out)
