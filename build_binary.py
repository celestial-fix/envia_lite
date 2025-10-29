import subprocess
import os
import shutil
import sys

# --- Configuration ---
SPEC_FILE = 'envialite.spec'
APP_NAME = 'Envía'
# Directories created by PyInstaller
BUILD_DIR = 'build'
DIST_DIR = 'dist'
# The final executable name will depend on your operating system, but the folder will be 'envialite'
# The executable is named 'envialite' or 'envialite.exe' or the macOS bundle is 'Envialite.app'

def check_pyinstaller():
    """Checks if PyInstaller is installed."""
    try:
        subprocess.run([sys.executable, '-m', 'PyInstaller', '--version'], check=True, capture_output=True)
        print(f"✅ PyInstaller is installed.")
        return True
    except subprocess.CalledProcessError:
        print("❌ Error: PyInstaller is not callable or installed correctly.")
        print("   Please install it using: pip install pyinstaller")
        return False
    except FileNotFoundError:
        print(f"❌ Error: Python executable not found or path issues. Executable: {sys.executable}")
        return False

def cleanup_build(directories_to_clean=[BUILD_DIR, DIST_DIR]):
    """Removes PyInstaller build and distribution directories."""
    print("--- Cleanup ---")
    for directory in directories_to_clean:
        if os.path.exists(directory):
            try:
                shutil.rmtree(directory)
                print(f"🗑️  Removed existing '{directory}/'")
            except Exception as e:
                print(f"❌ Failed to remove '{directory}/': {e}")
        else:
            print(f"☑️  Directory '{directory}/' does not exist.")

def run_build():
    """Executes PyInstaller using the spec file."""
    if not os.path.exists(SPEC_FILE):
        print(f"❌ Error: Specification file '{SPEC_FILE}' not found.")
        return

    print(f"\n--- Starting Build for {APP_NAME} ---")
    
    # Construct the PyInstaller command
    command = [sys.executable, '-m', 'PyInstaller', SPEC_FILE]
    
    try:
        # Run PyInstaller
        print(f"Running command: {' '.join(command)}")
        # Use subprocess.run for simple execution and capture output
        result = subprocess.run(command, check=True, capture_output=False, text=True)
        
        # Check if the compilation was successful
        if os.path.exists(os.path.join(DIST_DIR, 'envialite.exe')) or \
           os.path.exists(os.path.join(DIST_DIR, 'envialite')) or \
           os.path.exists(os.path.join(DIST_DIR, f'{APP_NAME}.app')):
            
            print("\n🎉 Build successful!")
            
            if sys.platform == 'darwin':
                print(f"Final application: {DIST_DIR}/{APP_NAME}.app")
            elif sys.platform == 'win32':
                print(f"Final executable: {DIST_DIR}/envialite/envialite.exe")
            else:
                print(f"Final executable directory: {DIST_DIR}/envialite/")
                
            print("Run the executable to launch the GUI and the server.")
        else:
            print("\n⚠️  Build finished, but expected output file not found in 'dist'. Check logs for errors.")

    except subprocess.CalledProcessError as e:
        print(f"\n❌ Build Failed (Exit Code {e.returncode})")
        print("\n--- STDOUT ---")
        print(e.stdout)
        print("\n--- STDERR ---")
        print(e.stderr)
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")

def main():
    if not check_pyinstaller():
        sys.exit(1)

    # Automatically clean up before starting the new build
    cleanup_build()
    
    # Run the build process
    run_build()

    # Optional: Clean up the temporary 'build' directory after a successful run
    # cleanup_build([BUILD_DIR]) 
    
if __name__ == "__main__":
    main()
