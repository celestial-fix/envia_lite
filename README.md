# Envía lite - Personal Mail Merge Tool

A minimal, single-user email merge application built with Python's built-in HTTP server. No databases, no complex dependencies - just simple email sending for personal use.

## ✨ Features

- 📧 **Simple Email Merging**: Send personalized emails using a template and tabular data
- 📎 **File Attachments**: Upload and attach files to emails with custom attachment support
- 👁️ **Enhanced Preview**: Navigate through email previews with full headers, body, and attachments
- 💾 **Browser Storage**: Saves templates, data, and attachments locally in your browser
- 🚀 **No Database**: Uses only browser localStorage for data persistence
- ⚡ **Lightweight**: Single Python file with no external dependencies
- 🎨 **Clean Interface**: Modern, responsive tabbed interface
- 🔒 **Personal Use**: Designed for single-user scenarios
- 🧪 **Demo Mode**: Safe testing mode that simulates email sending without actually sending emails
- 📦 **Multiple Deployment Options**: PyInstaller binary (standard user), Docker container, or direct Python

## 🚀 Quick Start

### Option 1: PyInstaller Binary (Recommended)
```bash
# Build the binary
python build_binary.py

# Run the simple GUI launcher
# Windows: double-click dist/envialite/envialite.exe
# macOS: double-click dist/Envialite.app
# Linux: run dist/envialite/envialite

# The launcher provides:
# • Port number field
# • Demo mode checkbox
# • Start/Stop server buttons
# • Clickable localhost link
# • Server status display
```

### Option 2: Docker Container
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t envialite .
docker run -d -p envialite
```

### Option 3: Direct Python
```bash
# Start the server (default port 8000)
python server.py

# Or specify a custom port
python server.py 3000

# Demo mode
python server.py --demo
```

The server will show the current mode:
- **DEMO MODE**: Connections and uploads are prevented
- **LIVE MODE**: Real emails are sent (set `DEMO_MODE = False` in server.py)

**GUI Note**: When using the PyInstaller binary, you can enable Demo Mode using the checkbox in the GUI interface.

Visit `http://localhost:8000` (or your chosen port) to access the application.

## How to Use

### 1. Enter Email Settings
- **From Email**: Email address that appears as sender
- **Subject**: Email subject line (can include template variables like `{{name}}`)

### 2. Create Email Template
Write your email template using `{{variable}}` syntax:
```
Hi {{name}},

Thank you for your interest in {{product}}.

We will contact you within {{timeframe}}.

Best regards,
Your Company
```

### 3. Add Data
Enter your data from CSV or Excel as copy/paste:
```csv
name,email,product,timeframe
John Doe,john@example.com,Product A,24 hours
Jane Smith,jane@example.com,Product B,48 hours
```
Or import a CSV file.

### 4. Manage Attachments (Optional)
- **Upload Files**: Add files as attachments
- **Attachments for All**: Select attachments that will appear in all emails
- **Attachments Variable**: Use an attachments variable to attach files according to the data table

### 5. Preview and Send
- **Preview**: Navigate through email previews before sending
- **Edit**: Make any last minute changes to the emails
- **Exclude**: Exclude specific emails from sending
- **Send**: Send all included emails to your recipients

## File Structure
```
envialite/
├── server.py          # Main Python server (email sending API + GUI launcher)
├── index.html         # Web interface
├── styles.css         # Styling
├── script.js          # Frontend functionality
├── build_binary.py    # PyInstaller build script
├── envialite.spec     # PyInstaller configuration
├── Dockerfile         # Docker container definition
├── docker-compose.yml # Docker Compose configuration
├── .dockerignore      # Docker build exclusions
├── LICENSE           # License file
└── README.md         # This documentation
```

## Development

To modify the application:

1. **Server changes**: Edit `server.py` for email functionality
2. **Frontend changes**: Modify `index.html`, `styles.css`, or `script.js`
3. **Restart server**: Changes require server restart to take effect

## License

This is a personal tool - use at your own risk.

## 📦 Deployment & Packaging

### Option 1: PyInstaller Binary (Desktop)
- **Cross-platform**: Windows (.exe), macOS (.app), Linux (executable)
- **GUI interface**: User-friendly server management
- **No dependencies**: Single file distribution
- **Build**: `python build_binary.py`

### Option 2: Docker Container (Server)
- **Alpine Linux**: Minimal, secure base image
- **Docker Compose**: Environment variable configuration
- **Health checks**: Monitoring and auto-restart
- **Deploy**: `docker-compose up -d`

### Option 3: Direct Python (Development)
- **No packaging**: Direct Python execution
- **Development**: Easy modification and testing
- **Run**: `python server.py [port]`
