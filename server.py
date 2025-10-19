#!/usr/bin/env python3
"""
Minimal email merge application using Python's built-in HTTP server.
Single-user, no database, stores everything client-side.
"""
import http.server
import socketserver
import json
import urllib.parse
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import csv
import io
import string
import os
import sys
import base64
import re

# Configuration
DEMO_MODE = False  # Set to False to enable actual email sending

class EmailMergeHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

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
        if self.path == '/send-emails':
            try:
                self.handle_send_emails()
            except Exception as e:
                print(f"Error in handle_send_emails: {e}")
                self.send_json_response({'success': False, 'error': f'Server error: {str(e)}'})
        elif self.path == '/test-smtp':
            try:
                self.handle_test_smtp()
            except Exception as e:
                print(f"Error in handle_test_smtp: {e}")
                self.send_json_response({'success': False, 'error': f'Server error: {str(e)}'})
        else:
            self.send_error(404, "Not Found")

    def handle_send_emails(self):
        try:
            if DEMO_MODE:
                # In demo mode, simulate email sending without actually sending
                self.send_demo_response()
                return

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            print(f"DEBUG: Received email data - Template length: {len(data.get('template', ''))}, CSV length: {len(data.get('csvData', ''))}")
            print(f"DEBUG: From email: {data.get('fromEmail', '')}")
            print(f"DEBUG: Attachments count: {len(data.get('attachments', {}))}")

            template = data.get('template', '')
            csv_data = data.get('csvData', '')
            from_email = data.get('fromEmail', '')
            attachments_data = data.get('attachments', {})  # Client-side attachment data

            # Get SMTP settings from client
            smtp_server = data.get('smtpServer', '')
            smtp_port = int(data.get('smtpPort', 587))
            smtp_user = data.get('smtpUser', '')
            smtp_password = data.get('smtpPassword', '')

            print(f"DEBUG: SMTP settings - Server: {smtp_server}, Port: {smtp_port}, User: {smtp_user}")

            # Parse CSV data - be more flexible about column names
            csv_lines = csv_data.strip().split('\n')
            if len(csv_lines) < 2:
                self.send_json_response({'success': False, 'error': 'CSV must have at least a header row and one data row'})
                return

            # Parse CSV manually to be more flexible
            csv_reader = csv.reader(io.StringIO(csv_data))
            rows = list(csv_reader)

            if len(rows) < 2:
                self.send_json_response({'success': False, 'error': 'CSV must have at least a header row and one data row'})
                return

            headers = [h.strip() for h in rows[0]]
            recipients = []

            for i, row in enumerate(rows[1:], 1):
                if len(row) == len(headers) and any(cell.strip() for cell in row):
                    recipient = {}
                    for j, header in enumerate(headers):
                        recipient[header] = row[j].strip() if j < len(row) else ''
                    recipient['_rowNumber'] = i
                    recipients.append(recipient)

            if not recipients:
                self.send_json_response({'success': False, 'error': 'No data rows found in CSV'})
                return

            # Send emails
            results = []
            for recipient in recipients:
                try:
                    # Merge template with recipient data
                    subject = self.merge_template(data.get('subject', 'Mail Merge'), recipient)
                    body = self.merge_template(template, recipient)

                    # Get attachments for this email
                    email_attachments = self.get_attachments_for_email(recipient, template, attachments_data)

                    # Send email with attachments using client SMTP settings
                    success = self.send_email_with_smtp_settings(
                        from_email,
                        recipient.get('email', ''),
                        subject,
                        body,
                        email_attachments,
                        smtp_server,
                        smtp_port,
                        smtp_user,
                        smtp_password
                    )

                    results.append({
                        'email': recipient.get('email', ''),
                        '_rowNumber': recipient.get('_rowNumber', 0),
                        'success': success,
                        'error': None if success else 'Failed to send'
                    })

                except Exception as e:
                    results.append({
                        'email': recipient.get('email', ''),
                        'success': False,
                        'error': str(e)
                    })

            success_count = sum(1 for r in results if r['success'])
            self.send_json_response({
                'success': True,
                'results': results,
                'summary': f'Sent {success_count} of {len(results)} emails'
            })

        except Exception as e:
            self.send_json_response({'success': False, 'error': str(e)})

    def handle_test_smtp(self):
        """Test SMTP connection with provided settings"""
        try:
            if DEMO_MODE:
                # In demo mode, always return success for testing
                self.send_json_response({'success': True, 'message': 'DEMO MODE: SMTP test skipped (always passes)'})
                return

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            smtp_server = data.get('smtpServer', '')
            smtp_port = int(data.get('smtpPort', 587))
            smtp_user = data.get('smtpUser', '')
            smtp_password = data.get('smtpPassword', '')

            if not all([smtp_server, smtp_user, smtp_password]):
                self.send_json_response({'success': False, 'error': 'Missing SMTP settings'})
                return

            # Test the connection
            try:
                server = smtplib.SMTP(smtp_server, smtp_port)
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.quit()
                self.send_json_response({'success': True, 'message': 'SMTP connection successful'})
            except Exception as e:
                self.send_json_response({'success': False, 'error': f'SMTP connection failed: {str(e)}'})

        except Exception as e:
            self.send_json_response({'success': False, 'error': str(e)})

    def send_demo_response(self):
        """Send demo response simulating successful email sending"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            csv_data = data.get('csvData', '')

            # Parse CSV to get recipient count
            csv_lines = csv_data.strip().split('\n')
            if len(csv_lines) >= 2:
                csv_reader = csv.reader(io.StringIO(csv_data))
                rows = list(csv_reader)
                recipients = [row for row in rows[1:] if any(cell.strip() for cell in row)]

                # Simulate successful sending for all recipients
                results = []
                for i, recipient in enumerate(recipients, 1):
                    results.append({
                        'email': recipient[1] if len(recipient) > 1 else f'Row {i}',
                        '_rowNumber': i,
                        'success': True,
                        'error': None
                    })

                self.send_json_response({
                    'success': True,
                    'results': results,
                    'summary': f'DEMO MODE: Would have sent {len(results)} emails successfully',
                    'demo': True
                })
            else:
                self.send_json_response({'success': False, 'error': 'No CSV data provided'})

        except Exception as e:
            self.send_json_response({'success': False, 'error': f'Demo mode error: {str(e)}'})

    def merge_template(self, template, variables):
        """Simple template variable replacement using {{variable}} format"""
        try:
            # Use the same format as client-side: {{variable}}
            result = template
            for key, value in variables.items():
                # Replace {{variable}} with actual value
                import re
                pattern = r'\{\{\s*' + re.escape(key) + r'\s*\}\}'
                result = re.sub(pattern, str(value) if value is not None else '', result)
            return result
        except Exception as e:
            print(f"Template merge error: {e}")
            return template

    def send_email(self, from_email, to_email, subject, body):
        """Send a single email"""
        try:
            msg = MIMEMultipart()
            msg['From'] = from_email
            msg['To'] = to_email
            msg['Subject'] = subject

            msg.attach(MIMEText(body, 'html'))

            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            text = msg.as_string()
            server.sendmail(from_email, to_email, text)
            server.quit()

            return True
        except Exception as e:
            print(f"Failed to send email to {to_email}: {e}")
            return False

    def get_attachments_for_email(self, recipient, template, attachments_data):
        """Extract attachment references from template and return matching files"""
        email_attachments = []

        # Debug logging
        print(f"DEBUG: Processing attachments for recipient: {recipient}")
        print(f"DEBUG: Available attachments: {list(attachments_data.keys())}")

        # Check if recipient has attachment column and it's not empty
        if 'attachment' in recipient and recipient['attachment'].strip():
            attachment_value = recipient['attachment'].strip()
            print(f"DEBUG: Found attachment column value: '{attachment_value}'")

            # Split by delimiter (semicolon by default)
            delimiter = ';'
            attachment_files = [f.strip() for f in attachment_value.split(delimiter) if f.strip()]

            for filename in attachment_files:
                print(f"DEBUG: Looking for attachment file: '{filename}'")

                # Look for the attachment in the provided data
                for stored_filename, attachment_data in attachments_data.items():
                    print(f"DEBUG: Checking stored file: '{stored_filename}'")

                    # Check for exact match or partial match
                    if (stored_filename == filename or
                        stored_filename.startswith(filename) or
                        filename.startswith(stored_filename) or
                        filename in stored_filename):

                        try:
                            # Extract base64 data from data URL
                            data_url = attachment_data.get('data', '')
                            if ',' in data_url:
                                base64_data = data_url.split(',')[1]

                                email_attachments.append({
                                    'filename': stored_filename,
                                    'data': base64_data,
                                    'type': attachment_data.get('type', 'application/octet-stream')
                                })
                                print(f"DEBUG: Successfully added attachment: {stored_filename}")
                                break
                            else:
                                print(f"DEBUG: Invalid data URL format for {stored_filename}")
                        except Exception as e:
                            print(f"DEBUG: Error processing attachment {stored_filename}: {e}")

        # Also check for {{attachment:filename}} pattern in template (legacy support)
        attachment_pattern = r'\{\{attachment:([^}]+)\}\}'
        matches = re.findall(attachment_pattern, template)

        for filename_template in matches:
            # Merge template variables in filename
            merged_filename = self.merge_template(filename_template, recipient)

            # Look for the attachment in the provided data
            for stored_filename, attachment_data in attachments_data.items():
                # Check for exact match or partial match
                if (stored_filename == merged_filename or
                    stored_filename.startswith(merged_filename) or
                    merged_filename.startswith(stored_filename) or
                    merged_filename in stored_filename):

                    try:
                        # Extract base64 data from data URL
                        data_url = attachment_data.get('data', '')
                        if ',' in data_url:
                            base64_data = data_url.split(',')[1]

                            email_attachments.append({
                                'filename': stored_filename,
                                'data': base64_data,
                                'type': attachment_data.get('type', 'application/octet-stream')
                            })
                            break
                    except Exception as e:
                        print(f"Error processing attachment {stored_filename}: {e}")

        print(f"DEBUG: Final attachments for email: {len(email_attachments)}")
        return email_attachments

    def send_email_with_attachments(self, from_email, to_email, subject, body, attachments):
        """Send email with attachments"""
        try:
            msg = MIMEMultipart()
            msg['From'] = from_email
            msg['To'] = to_email
            msg['Subject'] = subject

            # Attach HTML body
            msg.attach(MIMEText(body, 'html'))

            # Attach files
            for attachment in attachments:
                try:
                    # Decode base64 data
                    file_data = base64.b64decode(attachment['data'])

                    # Create MIME attachment
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(file_data)
                    encoders.encode_base64(part)

                    # Set attachment headers
                    part.add_header(
                        'Content-Disposition',
                        f'attachment; filename="{attachment["filename"]}"'
                    )
                    part.add_header('Content-Type', attachment['type'])

                    msg.attach(part)

                except Exception as e:
                    print(f"Error attaching file {attachment.get('filename', 'unknown')}: {e}")

            # Send email
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)

            text = msg.as_string()
            server.sendmail(from_email, to_email, text)
            server.quit()

            return True

        except Exception as e:
            print(f"Failed to send email to {to_email}: {e}")
            return False

    def send_email_with_smtp_settings(self, from_email, to_email, subject, body, attachments, smtp_server, smtp_port, smtp_user, smtp_password):
        """Send email with custom SMTP settings"""
        try:
            # Validate email addresses first
            if not self.is_valid_email(to_email):
                print(f"DEBUG: Invalid recipient email address: {to_email}")
                return False

            if not self.is_valid_email(from_email):
                print(f"DEBUG: Invalid sender email address: {from_email}")
                return False

            msg = MIMEMultipart()
            msg['From'] = from_email
            msg['To'] = to_email
            msg['Subject'] = subject

            # Attach HTML body
            msg.attach(MIMEText(body, 'html'))

            # Attach files
            for attachment in attachments:
                try:
                    # Decode base64 data
                    file_data = base64.b64decode(attachment['data'])

                    # Create MIME attachment
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(file_data)
                    encoders.encode_base64(part)

                    # Set attachment headers
                    part.add_header(
                        'Content-Disposition',
                        f'attachment; filename="{attachment["filename"]}"'
                    )
                    part.add_header('Content-Type', attachment['type'])

                    msg.attach(part)

                except Exception as e:
                    print(f"Error attaching file {attachment.get('filename', 'unknown')}: {e}")
                    return False

            # Send email with custom SMTP settings
            print(f"DEBUG: Attempting to send email to {to_email}")
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.set_debuglevel(1)  # Enable SMTP debugging

            try:
                server.starttls()
                server.login(smtp_user, smtp_password)

                text = msg.as_string()
                server.sendmail(from_email, to_email, text)
                server.quit()

                print(f"DEBUG: Email sent successfully to {to_email}")
                return True

            except smtplib.SMTPRecipientsRefused as e:
                print(f"DEBUG: SMTP rejected recipients for {to_email}: {e}")
                server.quit()
                return False
            except smtplib.SMTPSenderRefused as e:
                print(f"DEBUG: SMTP rejected sender for {to_email}: {e}")
                server.quit()
                return False
            except smtplib.SMTPAuthenticationError as e:
                print(f"DEBUG: SMTP authentication failed for {to_email}: {e}")
                server.quit()
                return False
            except Exception as e:
                print(f"DEBUG: SMTP error for {to_email}: {e}")
                server.quit()
                return False

        except Exception as e:
            print(f"Failed to send email to {to_email}: {e}")
            return False

    def is_valid_email(self, email):
        """Validate email address format"""
        import re
        email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        return re.match(email_pattern, email) is not None

    def send_json_response(self, data):
        """Send JSON response"""
        try:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response_json = json.dumps(data)
            self.wfile.write(response_json.encode('utf-8'))
        except Exception as e:
            print(f"Error sending JSON response: {e}")
            self.send_error(500, f"Internal server error: {str(e)}")

    def log_message(self, format, *args):
        # Override to reduce noise - only log errors
        if "POST" in format or "error" in format.lower():
            super().log_message(format, *args)

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

    print(f"Starting Envialite server on http://localhost:{port}")
    print(f"DEMO_MODE: {'ON' if DEMO_MODE else 'OFF'}")
    if DEMO_MODE:
        print("✅ Demo mode: No emails will actually be sent")
        print("   Set DEMO_MODE = False in server.py to enable real email sending")
    else:
        print("⚠️  Live mode: Emails will be sent for real!")
    print("Press Ctrl+C to stop")

    with socketserver.TCPServer(("", port), EmailMergeHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    main()
