# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Envialite application
Creates a single executable with embedded web server and optional GUI launcher
"""

import os
import sys
from pathlib import Path

# Get the current working directory
project_dir = Path(os.getcwd())

# Application info
app_name = 'Envía'
app_version = '1.0.0'
# CRITICAL FIX: The main script is now the consolidated server.py
main_script = 'server.py' 

# PyInstaller configuration
block_cipher = None

# Analysis: what to include
a = Analysis(
    [main_script],
    pathex=[str(project_dir)],
    binaries=[],
    datas=[
        # Include all web files (index.html, styles.css, script.js are assumed)
        (str(project_dir / 'index.html'), '.'),
        (str(project_dir / 'index-ES.html'), '.'),
        (str(project_dir / 'styles.css'), '.'),
        (str(project_dir / 'script.js'), '.'),
        (str(project_dir / 'script-ES.js'), '.'),
        # Include any other assets if they exist
        (str(project_dir / '*.md'), '.'),
    ],
    hiddenimports=[
        # GUI dependencies (Tkinter)
        'tkinter',
        'tkinter.ttk',
        'webbrowser',
        
        # Server dependencies (Crucial for embedded server execution)
        'ssl',           
        'email',         
        'socket',        
        'select',        
        'http.server',   
        'socketserver',  
        'mimetypes',     
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# PyZ: create the executable
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# Detect platform and create appropriate executable
import platform

current_platform = platform.system().lower()


if current_platform == 'darwin':  # macOS
    # For macOS, we create a minimal EXE and then wrap it in a BUNDLE.
    # This is the standard for creating .app packages (which is a directory).
    exe = EXE(
        pyz,
        a.scripts,
        [],
        exclude_binaries=True,
        name=app_name.lower(),
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,
        console=False,
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
    )
    app = BUNDLE(
        exe,
        a.binaries,
        a.zipfiles,
        a.datas,
        name=f'{app_name}.app',
        icon=None,  # Add icon file path if you have one
        bundle_identifier=f'com.envialite.{app_name.lower()}',
        info_plist={
            'CFBundleName': app_name,
            'CFBundleDisplayName': app_name,
            'CFBundleVersion': app_version,
            'CFBundleShortVersionString': app_version,
            'NSHighResolutionCapable': True,
        }
    )
else:  # Windows and Linux (One-file Build)
    # For Windows/Linux, we create a single-file EXE that contains everything.
    exe = EXE(
        pyz,
        a.scripts,
        a.binaries,
        a.zipfiles,
        a.datas,
        name=app_name.lower(),
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,
        console=False,
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
    )
