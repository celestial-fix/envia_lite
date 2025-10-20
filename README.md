# Envialite - Personal Mail Merge Tool

A minimal, single-user email merge application built with Python's built-in HTTP server. No databases, no complex dependencies - just simple email sending for personal use.

## Features

- 📧 **Simple Email Merging**: Send personalized emails using templates and CSV data
- 📎 **File Attachments**: Upload and attach files to emails with dynamic attachment support
- 👁️ **Enhanced Preview**: Navigate through detailed email previews with full headers, body, and attachments
- 💾 **Browser Storage**: Saves your templates, data, and attachments locally in your browser
- 🚀 **No Database**: Uses only browser localStorage for data persistence
- ⚡ **Lightweight**: Single Python file with no external dependencies
- 🎨 **Clean Interface**: Modern, responsive tabbed interface
- 🔒 **Personal Use**: Designed for single-user scenarios
- 🧪 **Demo Mode**: Safe testing mode that simulates email sending without actually sending emails

## Quick Start

### 1. Run the Server

```bash
# Navigate to the envialite directory
cd C:/users/pablo/code/envialite

# Start the server (default port 8000)
python server.py

# Or specify a custom port
python server.py 3000
```

The server will show the current mode:
- **DEMO MODE**: No emails are actually sent (safe for testing)
- **LIVE MODE**: Real emails are sent (set `DEMO_MODE = False` in server.py)

### 2. Open in Browser

Visit `http://localhost:8000` (or your chosen port) to access the application.

### 3. Configure SMTP Settings (Optional)

Use the **Settings** tab to configure your email provider:

- **SMTP Server**: `smtp.gmail.com` (Gmail), `smtp-mail.outlook.com` (Outlook), etc.
- **SMTP Port**: `587` (TLS) or `465` (SSL)
- **SMTP Username**: Your email address
- **SMTP Password**: Your email password or app password

**For Gmail**: Use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password.

### 4. Test Connection

Click **"Test Connection"** to verify your SMTP settings work correctly.

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
├── server.py      # Main Python server (email sending API)
├── index.html     # Web interface
├── styles.css     # Styling
├── script.js      # Frontend functionality
└── README.md      # This file
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

## To-Do

[] - Fix attachments
[] - Attachments fixing - attaching via file picker in the message preview editor
[] - Attachments fixing - attaching via file upload in the message preview editor
[] - Add/Fix displaying 'sent' or 'failed' for a message after sending
[] - Add 'included' or 'excluded for a message before sending, only send included ones
