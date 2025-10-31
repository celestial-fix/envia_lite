#!/usr/bin/env python3
"""
Minimal email merge application using Python's built-in HTTP server.
Single-user, no database, stores everything client-side.
Now includes the GUI launcher logic.
"""
import os
import re
import sys
import time
import json
import base64
import locale
import smtplib
import argparse
import platform
import webbrowser
import subprocess
import socketserver
import http.server
import urllib.parse

from email import encoders
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr, parseaddr

# --- CRITICAL FIX FOR WINDOWS EMOJI/UNICODE PRINTING ---
# On Windows, sys.stdout.encoding is often 'cp1252', which cannot handle emojis.
# This forces the terminal output to use UTF-8 if running on Windows.
if platform.system() == "Windows":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        # Fallback for older Python versions or restricted environments
        print("Warning: Could not reconfigure sys.stdout/stderr to UTF-8.")
# --------------------------------------------------------


# Configuration
DEMO_MODE = False # Default to live mode

# --- PyInstaller Resource Handling ---

def resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller."""
    # Checks for the temporary folder where PyInstaller extracts files
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    # If running in development, assume resources are in the same directory
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)

# --- GUI Launcher Class ---

def launch_gui():
    """
    Dynamically imports tkinter and launches the GUI.
    This function contains all GUI-related code to keep it isolated.
    """
    import tkinter as tk
    from tkinter import ttk

    GUI_LANGUAGES = {
        'en': {
            'title': "Envía Launcher",
            'port_label': "Port:",
            'demo_checkbox': "Demo Mode (Safe Testing)",
            'start_btn': "Start Server",
            'stop_btn': "Stop Server",
            'status_stopped': "Server stopped",
            'status_starting': "Server starting on port {port}...",
            'status_running': "Server running successfully on port {port}",
            'status_error_port_range': "Error: Port must be between 1024 and 65535.",
            'status_error_already_running': "Error: Server is already running.",
            'status_error_start_failed': "Server failed to start (Code: {code}).\nERROR: {error_msg}",
            'status_error_start_failed_generic': "Server failed to start.\nPossible cause: Missing Python dependencies or port conflict.",
            'status_stopping': "Stopping server...",
            'status_stopped_clean': "Server stopped",
            'status_error_stopping': "Error stopping: {error_msg}",
            'status_not_running': "Server is not running.",
            'status_fatal_error': "Fatal Error: Failed to launch server process. Details: {error_msg}",
            'status_open_browser_first': "Start the server before opening the browser.",
            'web_app_lang_label': "Web App Language:",
            'gui_lang_label': "Launcher Language:",
        },
        'es': {
            'title': "Lanzador Envía",
            'port_label': "Puerto:",
            'demo_checkbox': "Modo Demo (Pruebas Seguras)",
            'start_btn': "Iniciar Servidor",
            'stop_btn': "Detener Servidor",
            'status_stopped': "Servidor detenido",
            'status_starting': "Iniciando servidor en el puerto {port}...",
            'status_running': "Servidor iniciado correctamente en el puerto {port}",
            'status_error_port_range': "Error: El puerto debe estar entre 1024 y 65535.",
            'status_error_already_running': "Error: El servidor ya está en ejecución.",
            'status_error_start_failed': "El servidor no pudo iniciar (Código: {code}).\nERROR: {error_msg}",
            'status_error_start_failed_generic': "El servidor no pudo iniciar.\nCausa posible: Dependencias de Python faltantes o conflicto de puerto.",
            'status_stopping': "Deteniendo servidor...",
            'status_stopped_clean': "Servidor detenido",
            'status_error_stopping': "Error al detener: {error_msg}",
            'status_not_running': "El servidor no está en ejecución.",
            'status_fatal_error': "Error fatal: No se pudo iniciar el proceso del servidor. Detalles: {error_msg}",
            'status_open_browser_first': "Inicie el servidor antes de abrir el navegador.",
            'web_app_lang_label': "Idioma de la Aplicación Web:",
            'gui_lang_label': "Idioma del Lanzador:",
        }
    }

    class EnvialiteLauncher:
        def __init__(self, root):
            self.root = root
            # Detect system language for GUI localization
            system_locale = locale.getdefaultlocale()[0]
            initial_gui_lang = 'es' if system_locale and system_locale.startswith('es') else 'en'
            self.gui_lang_var = tk.StringVar(value=initial_gui_lang)
            self.web_app_lang_var = tk.StringVar(value=initial_gui_lang)

            self.root.title(self._('title'))
            self.root.geometry("400x300") 
            self.root.resizable(False, False)

            # sys.executable points to the current running binary/interpreter
            self.executable_path = sys.executable

            self.port_var = tk.StringVar(value="8000")
            self.demo_var = tk.BooleanVar(value=False)
            self.status_var = tk.StringVar(value=self._('status_stopped'))
            self.server_process = None 

            self.create_gui()
            self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
            self.gui_lang_var.trace_add('write', self.update_gui_texts)

        def _(self, key):
            """Translation helper function for GUI texts"""
            return GUI_LANGUAGES.get(self.gui_lang_var.get(), GUI_LANGUAGES['en']).get(key, f'MISSING_TRANSLATION_{key}')

        def update_gui_texts(self, *args):
            """Updates all GUI texts based on the selected GUI language."""
            self.root.title(self._('title'))
            self.port_label.config(text=self._('port_label'))
            self.demo_check.config(text=self._('demo_checkbox'))
            self.start_btn.config(text=self._('start_btn'))
            self.stop_btn.config(text=self._('stop_btn'))
            # Update status if it's a default message
            if self.status_var.get() == GUI_LANGUAGES['en']['status_stopped'] or \
               self.status_var.get() == GUI_LANGUAGES['es']['status_stopped']:
                self.status_var.set(self._('status_stopped'))
            self.web_app_lang_label.config(text=self._('web_app_lang_label'))
            self.gui_lang_label.config(text=self._('gui_lang_label'))

        def create_gui(self):
            """Create the simple GUI"""
            frame = ttk.Frame(self.root, padding="20")
            frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
            self.root.grid_columnconfigure(0, weight=1)
            self.root.grid_rowconfigure(0, weight=1)
            frame.grid_columnconfigure(1, weight=1)
            frame.grid_columnconfigure(0, weight=0)

            row_idx = 0

            # Port Input
            ttk.Label(frame, text="Port:").grid(row=0, column=0, sticky=tk.W, pady=5)
            self.port_label = ttk.Label(frame, text=self._('port_label'))
            self.port_label.grid(row=row_idx, column=0, sticky=tk.W, pady=5)
            port_entry = ttk.Entry(frame, textvariable=self.port_var, width=10)
            port_entry.grid(row=row_idx, column=1, sticky=(tk.W, tk.E), padx=(10, 0), pady=5)
            row_idx += 1

            # Demo Checkbox
            self.demo_check = ttk.Checkbutton(frame, text=self._('demo_checkbox'), variable=self.demo_var)
            self.demo_check.grid(row=row_idx, column=0, columnspan=2, sticky=tk.W, pady=(10, 0))
            row_idx += 1

            # Web App Language Radio Buttons
            self.web_app_lang_label = ttk.Label(frame, text=self._('web_app_lang_label'))
            self.web_app_lang_label.grid(row=row_idx, column=0, sticky=tk.W, pady=(10, 0))
            
            web_app_lang_frame = ttk.Frame(frame)
            web_app_lang_frame.grid(row=row_idx, column=1, sticky=(tk.W, tk.E), padx=(10, 0), pady=(10, 0))
            
            ttk.Radiobutton(web_app_lang_frame, text="English", variable=self.web_app_lang_var, value="en").pack(side=tk.LEFT, padx=5)
            ttk.Radiobutton(web_app_lang_frame, text="Español", variable=self.web_app_lang_var, value="es").pack(side=tk.LEFT, padx=5)
            row_idx += 1

            # GUI Language Radio Buttons
            self.gui_lang_label = ttk.Label(frame, text=self._('gui_lang_label'))
            self.gui_lang_label.grid(row=row_idx, column=0, sticky=tk.W, pady=(10, 0))

            gui_lang_frame = ttk.Frame(frame)
            gui_lang_frame.grid(row=row_idx, column=1, sticky=(tk.W, tk.E), padx=(10, 0), pady=(10, 0))

            ttk.Radiobutton(gui_lang_frame, text="English", variable=self.gui_lang_var, value="en").pack(side=tk.LEFT, padx=5)
            ttk.Radiobutton(gui_lang_frame, text="Español", variable=self.gui_lang_var, value="es").pack(side=tk.LEFT, padx=5)
            row_idx += 1

            # Buttons
            button_frame = ttk.Frame(frame)
            button_frame.grid(row=row_idx, column=0, columnspan=2, pady=(20, 0))

            self.start_btn = ttk.Button(button_frame, text=self._('start_btn'), command=self.start_server, width=15)
            self.start_btn.pack(side=tk.LEFT, padx=(0, 10))

            self.stop_btn = ttk.Button(button_frame, text=self._('stop_btn'), command=self.stop_server, state=tk.DISABLED, width=15)
            self.stop_btn.pack(side=tk.LEFT)
            row_idx += 1

            # Status Label (larger font)
            status_label = ttk.Label(frame, textvariable=self.status_var, wraplength=300, justify=tk.LEFT, font=('TkDefaultFont', 10, 'bold'))
            status_label.grid(row=row_idx, column=0, columnspan=2, pady=(15, 5), sticky=tk.W)
            row_idx += 1

            # URL Label (clickable)
            self.url_text = tk.StringVar(value='http://localhost:8000') 
            self.url_label = ttk.Label(frame, textvariable=self.url_text, foreground="blue", cursor="hand2") # Changed from row 4 to row_idx
            self.url_label.grid(row=row_idx, column=0, columnspan=2, pady=(5,0), sticky=tk.W)
            self.url_label.bind("<Button-1>", self.open_browser)

        def update_button_state(self, is_running):
            """Helper to manage button state"""
            if is_running:
                self.start_btn.config(state=tk.DISABLED)
                self.stop_btn.config(state=tk.NORMAL)
            else:
                self.start_btn.config(state=tk.NORMAL)
                self.stop_btn.config(state=tk.DISABLED)

        def start_server(self):
            """Start the server by launching a new instance of the executable without the --gui flag"""
            if self.server_process:
                self.status_var.set(self._('status_error_already_running'))
                return

            try:
                port = int(self.port_var.get())
                if not (1024 <= port <= 65535):
                    self.status_var.set(self._('status_error_port_range'))
                    return
                
                # CRITICAL: Launch the same executable. Arguments are port and optional --demo.
                # Since the new logic checks for 'frozen' status, this sub-process will run the server
                # because it will have arguments (the port number).
                command = [self.executable_path, str(port)]
                if self.demo_var.get():
                    command.append('--demo')
                
                self.status_var.set(self._('status_starting').format(port=port))
                
                creationflags = 0
                if sys.platform == 'win32':
                    # Prevents a new console window and detaches the process
                    creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP

                # Launch the subprocess, keeping pipes open
                self.server_process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE, 
                    stderr=subprocess.PIPE,
                    creationflags=creationflags,
                    close_fds=False
                )
                
                time.sleep(0.05) # Give the OS time to start the process
                poll_result = self.server_process.poll()
                
                if poll_result is not None: # Process died immediately
                    # Read any output from the pipes
                    stdout, stderr = self.server_process.communicate(timeout=0.5)
                    self.server_process = None
                    
                    error_message = self._('status_error_start_failed').format(code=poll_result, error_msg="")
                    if stderr:
                        error_message = self._('status_error_start_failed').format(code=poll_result, error_msg=stderr.decode('utf-8', errors='ignore').strip())
                    else:
                         error_message = self._('status_error_start_failed_generic')                    
                    
                    print(f"Server failed: {error_message}")
                    self.status_var.set(error_message[:200]) 
                    self.update_button_state(False)
                    return

                self.status_var.set(self._('status_running').format(port=port))
                # Construct URL with selected web app language
                web_app_lang_prefix = f"{self.web_app_lang_var.get()}/" if self.web_app_lang_var.get() != 'en' else ''
                self.url_text.set(f'http://localhost:{port}/{web_app_lang_prefix}')
                self.update_button_state(True)

            except ValueError:
                self.status_var.set(self._('status_error_port_range'))
            except Exception as e:
                self.status_var.set(self._('status_fatal_error').format(error_msg=e))
                if self.server_process:
                    self.server_process.terminate()
                    self.server_process = None
                self.update_button_state(False)

        def stop_server(self):
            """Stop the server by terminating the process"""
            if self.server_process:
                self.status_var.set(self._('status_stopping'))
                try:
                    self.server_process.terminate()
                    self.server_process.wait(timeout=1) 
                except subprocess.TimeoutExpired:
                    self.server_process.kill()
                    self.server_process.wait()
                except Exception as e:
                    self.status_var.set(self._('status_error_stopping').format(error_msg=e))
                    return
                
                self.server_process = None
                self.status_var.set(self._('status_stopped_clean'))
                self.update_button_state(False)
            else:
                self.status_var.set(self._('status_not_running'))
                self.update_button_state(False)

        def on_closing(self):
            """Handler to stop the server when the window is closed."""
            self.stop_server() 
            self.root.destroy() 

        def open_browser(self, event=None):
            """Open browser"""
            if self.server_process:
                webbrowser.open(self.url_text.get())
            else:
                self.status_var.set(self._('status_open_browser_first'))

    # The GUI will handle launching the server sub-process
    root = tk.Tk()
    app = EnvialiteLauncher(root)
    root.mainloop()


# --- Original Server Handler Class ---

class EmailMergeHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # The directory needs to be set to the location of the assets (index.html, etc.)
        # This is correctly handled by resource_path in the do_GET method now, so we remove the directory kwarg
        # and simply rely on the default behavior for SimpleHTTPRequestHandler setup.
        super().__init__(*args, **kwargs)

    def end_headers(self):
        # Enable CORS for all responses
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        # This endpoint is now handled by do_GET
        if self.path == '/api/status':
            self.send_error(405, "Method Not Allowed")
            return
        if self.path == '/send-emails':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))

                results = []

                if DEMO_MODE:
                    emails_to_send = data.get('emails', [])
                    for email_data in emails_to_send:
                        if 'results' not in locals():
                            results = []
                        results.append({'email': email_data.get('to'), 'success': True, 'error': None})
                    summary = f"Simulated sending {len(results)} emails (Demo Mode)."
                    self.send_json_response({'success': True, 'summary': summary, 'results': results})
                    return

                # Live Mode Logic
                smtp_server = data.get('smtpServer')
                smtp_port = data.get('smtpPort')
                smtp_user = data.get('smtpUser')
                smtp_password = data.get('smtpPassword')
                emails_to_send = data.get('emails', [])

                if not all([smtp_server, smtp_port, smtp_user, smtp_password]):
                    self.send_json_response({'success': False, 'error': 'Missing SMTP credentials.'})
                    return

                with smtplib.SMTP(smtp_server, smtp_port) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_password)

                    for email_data in emails_to_send:
                        recipient_email = email_data.get('to')
                        try:
                            msg = MIMEMultipart()
                            from_header = email_data.get('from')
                            name, email = parseaddr(from_header)
                            msg['From'] = formataddr((name, email))

                            # Handle multiple recipients in To, Cc, and Bcc fields
                            if recipient_email:
                                to_addrs = [addr.strip() for addr in re.split(r'[;,]', recipient_email) if addr.strip()]
                                msg['To'] = ', '.join(to_addrs)

                            msg['Subject'] = email_data.get('subject')

                            if email_data.get('cc'):
                                cc_addrs = [addr.strip() for addr in re.split(r'[;,]', email_data.get('cc')) if addr.strip()]
                                msg['Cc'] = ', '.join(cc_addrs)

                            if email_data.get('bcc'):
                                bcc_addrs = [addr.strip() for addr in re.split(r'[;,]', email_data.get('bcc')) if addr.strip()]
                                msg['Bcc'] = ', '.join(bcc_addrs)

                            # Convert plain text newlines to HTML line breaks
                            body_content = email_data.get('body', '')
                            msg.attach(MIMEText(body_content.replace('\n', '<br>'), 'html'))

                            for attachment in email_data.get('attachments', []):
                                part = MIMEBase('application', 'octet-stream')
                                _, b64_data = attachment['data'].split(',', 1)
                                part.set_payload(base64.b64decode(b64_data))
                                encoders.encode_base64(part)
                                part.add_header('Content-Disposition', f'attachment; filename="{attachment["filename"]}"')
                                msg.attach(part)

                            server.send_message(msg)
                            results.append({'email': recipient_email, 'success': True, 'error': None, 'message': email_data})
                        except Exception as e:
                            results.append({'email': recipient_email, 'success': False, 'error': str(e), 'message': email_data})
                
                summary = f"Processed {len(results)} emails."
                self.send_json_response({'success': True, 'summary': summary, 'results': results})

            except Exception as e:
                self.send_json_response({'success': False, 'error': f'Server error: {str(e)}'})

        elif self.path == '/test-smtp':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))

                smtp_server = data.get('smtpServer')
                smtp_port = data.get('smtpPort')
                smtp_user = data.get('smtpUser')
                smtp_password = data.get('smtpPassword')

                if not all([smtp_server, smtp_port, smtp_user, smtp_password]):
                    self.send_json_response({'success': False, 'error': 'Missing SMTP credentials.'})
                    return

                # If in demo mode, simulate success without actually connecting
                if DEMO_MODE:
                    self.send_json_response({'success': True, 'message': 'Connection successful (Demo Mode)'})
                    self.send_json_response({'success': False, 'error': 'Missing SMTP credentials.'})
                    return

                try:
                    with smtplib.SMTP(smtp_server, smtp_port) as server:
                        server.starttls()
                        server.login(smtp_user, smtp_password)
                    self.send_json_response({'success': True})
                except smtplib.SMTPAuthenticationError:
                    self.send_json_response({'success': False, 'error': 'Authentication failed. Check username/password.'})
                except Exception as e:
                    self.send_json_response({'success': False, 'error': str(e)})

            except json.JSONDecodeError:
                self.send_json_response({'success': False, 'error': 'Invalid JSON format.'})
            except Exception as e:
                self.send_json_response({'success': False, 'error': f'Internal server error: {str(e)}'})
        else:
            self.send_error(404)

    def do_GET(self):
        """Handle file requests (index.html, styles.css, script.js) with language support"""
        if self.path == '/favicon.ico':
            self.send_response(204)  # No Content
            self.end_headers()
            return

        # Add a new endpoint to get the server status
        if self.path == '/api/status':
            self.send_json_response({'demoMode': DEMO_MODE})
            return

        # Parse the URL path
        requested_path = self.path.lstrip('/')

        # Determine language from path prefix (e.g., /es/index.html)
        # This logic is used when the GUI launcher constructs a URL like http://localhost:8000/es/
        current_lang = 'en' # Default language
        lang_prefix_match = re.match(r'^(en|es)/', requested_path)
        if lang_prefix_match:
            current_lang = lang_prefix_match.group(1)
            requested_path = requested_path[len(lang_prefix_match.group(0)):].lstrip('/') # Remove the language prefix


        # Determine which file to serve based on the requested path and language
        path_to_serve = 'index.html'  # Default fallback

        if not requested_path or requested_path == '/':
            # Serve language-specific index file
            if current_lang == 'es':
                path_to_serve = 'index-ES.html'  # Spanish file
            elif current_lang == 'en':
                path_to_serve = 'index.html'
            else:
                path_to_serve = 'index.html'     # English file (fallback)
        elif requested_path == 'script.js':
            # Serve language-specific script file
            if current_lang == 'es':
                path_to_serve = 'script-ES.js'  # Spanish script
            elif current_lang == 'en':
                path_to_serve = 'script.js'
            else:
                path_to_serve = 'script.js'    # English script (fallback)
        else:
            # For other resources (CSS, etc.), serve as-is
            path_to_serve = requested_path

        # If the request is for a specific language's index/script, ensure it's served
        if requested_path == 'index.html' and current_lang == 'es':
            path_to_serve = 'index-ES.html'

        if requested_path == 'script.js' and current_lang == 'es':
            path_to_serve = 'script-ES.js'

        try:
            full_path = resource_path(path_to_serve)

            if not os.path.exists(full_path):
                self.send_error(404, f'File Not Found: {path_to_serve}')
                return

            self.send_response(200)

            # Determine MIME type
            if path_to_serve.endswith('.html'):
                self.send_header('Content-type', 'text/html; charset=utf-8')
            elif path_to_serve.endswith('.css'):
                self.send_header('Content-type', 'text/css')
            elif path_to_serve.endswith('.js'):
                self.send_header('Content-type', 'application/javascript; charset=utf-8')
            else:
                self.send_header('Content-type', 'application/octet-stream')

            self.end_headers()

            with open(full_path, 'rb') as file:
                self.wfile.write(file.read())

        except Exception as e:
            print(f"Error serving file {path_to_serve}: {e}")
            self.send_error(500, 'Internal Server Error')

    def get_language_preference(self):
        """Get language preference from URL parameter or browser settings"""
        # Check for ?lang= parameter first (overrides everything)
        parsed_url = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed_url.query)
        if 'lang' in query_params:
            lang = query_params['lang'][0].lower()
            if lang in ['en', 'es']:
                return lang

        # Check Accept-Language header for auto-detection
        accept_lang = self.headers.get('Accept-Language', '')
        if accept_lang:
            # Parse Accept-Language header (e.g., "es-ES,en-US;q=0.9")
            # Simple approach: look for 'es' first
            if accept_lang.lower().startswith('es'):
                return 'es'

        # Default to English
        return 'en'

    def send_json_response(self, data):
        """Helper to send a JSON response"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        response_json = json.dumps(data)
        self.wfile.write(response_json.encode('utf-8'))

    def log_message(self, format, *args):
        # Override to reduce noise - only log errors
        if "POST" in format or "error" in format.lower():
            super().log_message(format, *args)


# --- Main Application Entry Point ---

def main():
    parser = argparse.ArgumentParser(description='Envialite Email Merge Server and Launcher.')
    parser.add_argument('-g', '--gui', action='store_true', help='Launch the graphical user interface.')
    parser.add_argument('-d', '--demo', action='store_true', help='Enable demo mode (safe testing).')
    parser.add_argument('port', type=int, nargs='?', default=8000, help='Port number to run the server on.')
    
    # Check if running as a frozen PyInstaller executable AND if it's the main entry point (no arguments).
    # This is the core logic for the hybrid approach.
    is_frozen_main_entry = hasattr(sys, '_MEIPASS') and len(sys.argv) == 1

    # 1. FROZEN MODE (PyInstaller Binary, primary launch) -> Always launch GUI
    if is_frozen_main_entry:
        print("Launching GUI from frozen binary...")
        launch_gui()
        return

    # 2. DEVELOPMENT MODE (python server.py) OR SUB-PROCESS MODE (launched by GUI)
    
    # Parse arguments for either server (default) or explicit GUI launch
    args = parser.parse_args()

    # Set DEMO_MODE from arguments before it's used
    global DEMO_MODE
    DEMO_MODE = args.demo

    port = args.port

    print(f"Starting Envialite server on http://localhost:{port}")
    print(f"DEMO_MODE: {'ON' if DEMO_MODE else 'OFF'}")
    if DEMO_MODE:
        print("✅ Demo mode: No emails will actually be sent")
    else:
        print("⚠️  Live mode: Emails will be sent for real")

    try:
        Handler = EmailMergeHandler
        with socketserver.TCPServer(("", port), Handler) as httpd:
            print(f"Server listening on port {port}")
            httpd.serve_forever()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Error: Port {port} is already in use. Try a different port.")
            sys.exit(1)
        print(f"❌ Server initialization error: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nServer shutting down.")
        sys.exit(0)

if __name__ == "__main__":
    main()
