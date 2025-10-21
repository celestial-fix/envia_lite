# Envialite - Personal Mail Merge Tool

A minimal, single-user email merge application built with Python's built-in HTTP server. No databases, no complex dependencies - just simple email sending for personal use.

## ✨ Features

- 📧 **Simple Email Merging**: Send personalized emails using templates and CSV data
- 📎 **File Attachments**: Upload and attach files to emails with dynamic attachment support
- 👁️ **Enhanced Preview**: Navigate through detailed email previews with full headers, body, and attachments
- 💾 **Browser Storage**: Saves your templates, data, and attachments locally in your browser
- 🚀 **No Database**: Uses only browser localStorage for data persistence
- ⚡ **Lightweight**: Single Python file with no external dependencies
- 🎨 **Clean Interface**: Modern, responsive tabbed interface with blue theme
- 🔒 **Personal Use**: Designed for single-user scenarios
- 🧪 **Demo Mode**: Safe testing mode that simulates email sending without actually sending emails
- 📦 **Multiple Deployment Options**: PyInstaller binary, Docker container, or direct Python

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
docker run -d -p 8000:8000 envialite
```

### Option 3: Direct Python
```bash
# Start the server (default port 8000)
python server.py

# Or specify a custom port
python server.py 3000
```

The server will show the current mode:
- **DEMO MODE**: No emails are actually sent (safe for testing)
- **LIVE MODE**: Real emails are sent (set `DEMO_MODE = False` in server.py)

**GUI Note**: When using the PyInstaller binary, you can enable Demo Mode using the checkbox in the GUI interface.

Visit `http://localhost:8000` (or your chosen port) to access the application.

## How to Use

### 1. Enter Email Settings
- **From Email**: Your email address
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

### 3. Add CSV Data
Enter your recipient data in CSV format:
```csv
name,email,product,timeframe
John Doe,john@example.com,Product A,24 hours
Jane Smith,jane@example.com,Product B,48 hours
```

**Required columns**: `name`, `email` (other columns are optional)

### 4. Manage Attachments (Optional)
- **Upload Files**: Add PDF, DOC, images, or other files as attachments
- **Dynamic Attachments**: Use `{{attachment:filename}}` in templates to attach files
- **Variable Attachments**: Use `{{attachment:{{product}}.pdf}}` for dynamic attachment selection

### 5. Preview and Send
- **Enhanced Preview**: Navigate through detailed email previews with full headers, body, and attachments
- **Individual Review**: Use Previous/Next buttons to review each email individually
- **Attachment Preview**: See which files will be attached to each email
- **Send**: Send all emails to your recipients with attachments
- **Save/Load**: Your data is automatically saved to browser storage

## File Structure

```
envialite/
├── server.py          # Main Python server (email sending API + GUI launcher)
├── index.html         # Web interface
├── styles.css         # Blue theme styling
├── script.js          # Frontend functionality
├── build_binary.py    # PyInstaller build script
├── envialite.spec     # PyInstaller configuration
├── Dockerfile         # Docker container definition
├── docker-compose.yml # Docker Compose configuration
├── .dockerignore      # Docker build exclusions
├── LICENSE           # License file
└── README.md         # This documentation
```

## Template Variables

Use `{{variable}}` syntax in your templates. Variables are automatically replaced with values from your CSV data:

- `{{name}}` → John Doe
- `{{email}}` → john@example.com
- `{{product}}` → Product A

## Attachment Variables

Use `{{attachment:filename}}` syntax to attach files to your emails:

- `{{attachment:brochure.pdf}}` → Attach specific file
- `{{attachment:{{product}}.pdf}}` → Dynamic attachment based on CSV data
- `{{attachment:invoice_{{id}}.pdf}}` → Attach with merged filename

**Supported file types**: PDF, DOC, DOCX, TXT, JPG, PNG (max 10MB per file)

## CSV Format

Your CSV data should include these columns:
- **name**: Recipient's name
- **email**: Recipient's email address (required)
- **Additional columns**: Any other data you want to use in templates

Example:
```csv
name,email,product,price
Alice Johnson,alice@example.com,Widget A,$19.99
Bob Wilson,bob@example.com,Widget B,$24.99
```

## Troubleshooting

### Common Issues

1. **"No valid recipients found"**
   - Check your CSV format (comma-separated values)
   - Ensure you have `name` and `email` columns
   - Verify email addresses are valid

2. **"Failed to send emails"**
   - Check your SMTP settings in the Settings tab
   - Verify your email credentials
   - Ensure your email provider allows SMTP access
   - Use "Test Connection" to verify settings

3. **"Data not saving"**
   - Check browser console for errors
   - Ensure localStorage is enabled
   - Try refreshing the page

### Email Provider Settings

**Gmail:**
- SMTP Server: `smtp.gmail.com`
- Port: `587`
- Use App Password instead of regular password

**Outlook/Hotmail:**
- SMTP Server: `smtp-mail.outlook.com`
- Port: `587`

**Yahoo:**
- SMTP Server: `smtp.mail.yahoo.com`
- Port: `587`

## Security Notes

- This is designed for personal use only
- Email credentials are stored in plain text in `server.py`
- No user authentication or access controls
- Data is stored locally in your browser

## Development

To modify the application:

1. **Server changes**: Edit `server.py` for email functionality
2. **Frontend changes**: Modify `index.html`, `styles.css`, or `script.js`
3. **Restart server**: Changes require server restart to take effect

## License

This is a personal tool - use at your own risk.

## 🎉 Project Status: PRODUCTION READY!

### ✅ **All Major Features Completed:**
- **Clean UI**: Blue theme, decluttered interface
- **Full Attachment Support**: Upload, preview, and dynamic attachment system
- **Enhanced Email Preview**: Navigate through emails with full details
- **Cross-Platform Packaging**: PyInstaller binary for all platforms
- **Docker Support**: Containerized deployment with health checks
- **Professional Distribution**: Multiple deployment options

### 🚀 **Ready for Use:**
- **Desktop Users**: Just run the PyInstaller binary
- **Server Deployment**: Use Docker containers
- **Development**: Direct Python execution
- **All Platforms Supported**: Windows, macOS, Linux

### 📦 **Distribution Ready:**
- **Binary Package**: `dist/envialite/` - Cross-platform executables
- **Docker Images**: `docker-compose up -d` - Instant deployment
- **Documentation**: Complete setup and usage guides

**The Envialite application is now fully functional, professionally packaged, and ready for production use!** 🎊

---
*Built with ❤️ for personal email automation needs*

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

## ✅ Completed Features

### ✅ **Interface & Styling**
- [x] **Clean Interface**: Removed unnecessary buttons and clutter
- [x] **Blue Theme**: Changed from blue-purple gradient to clean blue
- [x] **Reset Button**: Moved to main actions section with red styling
- [x] **Delete Buttons**: Changed from elliptical to rounded rectangular

### ✅ **Attachment System**
- [x] **File Upload**: Upload attachments in main Attachments tab
- [x] **Preview Upload**: Upload files directly in email preview
- [x] **Dynamic Attachments**: Use `{{attachment:filename}}` in templates
- [x] **Variable Attachments**: Use `{{attachment:{{product}}.pdf}}` for CSV-based selection

### ✅ **Email Features**
- [x] **From Name Field**: Separate name and email fields
- [x] **Template Variables**: Full support for `{{variable}}` replacement
- [x] **Enhanced Preview**: Navigate through emails with full details
- [x] **Email Status**: Shows sent/failed status after sending

### ✅ **Code Quality**
- [x] **Removed Auto-save**: Eliminated redundant save functionality
- [x] **Clean Code**: Removed unnecessary functions and complexity
- [x] **Error Handling**: Proper error messages and validation

### ✅ **GUI & Packaging**
- [x] **Demo Mode Checkbox**: GUI control for safe testing mode
- [x] **No Console Windows**: Clean PyInstaller execution
- [x] **Cross-Platform**: Windows, macOS, and Linux support
- [x] **Docker Integration**: Single-stage Alpine container with Compose

## 🚧 Remaining Tasks

### 🔄 **Future Enhancements**
- [ ] **Email Status Display**: Show sent/failed status for each email in preview
- [ ] **Email Selection**: Include/exclude specific emails before sending
- [ ] **Enhanced Forms**: Improve visual appeal of form layouts
- [ ] **Advanced Features**: Additional email sending options

## 📋 Current File Structure

```
envialite/
├── server.py          # Main Python server (email sending API + GUI launcher)
├── index.html         # Web interface
├── styles.css         # Blue theme styling
├── script.js          # Frontend functionality
├── build_binary.py    # PyInstaller build script
├── envialite.spec     # PyInstaller configuration
├── Dockerfile         # Docker container definition (Alpine Linux)
├── docker-compose.yml # Docker Compose configuration
├── .dockerignore      # Docker build exclusions
├── LICENSE           # License file
├── README.md         # This documentation
├── .git/             # Git repository
├── .venv/            # Python virtual environment (optional)
├── build/            # PyInstaller build artifacts (generated)
└── dist/             # PyInstaller distribution (generated)
```

## 🔧 Technical Implementation

### ✅ **Container Compatibility**
- **Conditional tkinter imports**: GUI components only loaded when needed
- **Alpine Linux optimized**: Minimal base image with only required dependencies
- **Multi-stage deployment**: Single codebase supports both desktop and server deployment
- **Health checks**: Docker container includes monitoring and auto-restart capabilities

### ✅ **Cross-Platform Support**
- **PyInstaller binary**: Cross-platform desktop application (Windows, macOS, Linux)
- **Docker container**: Server deployment with consistent environment
- **Direct Python**: Development and testing without packaging

### ✅ **Code Architecture**
- **Single file design**: All server logic in `server.py` for simplicity
- **Hybrid GUI/Server**: Same file handles both GUI launcher and HTTP server
- **Conditional loading**: GUI components only imported when GUI is actually used
- **Resource handling**: Automatic path resolution for PyInstaller and development modes
