#!/usr/bin/env python3
"""
Minimal email merge application using Python's built-in HTTP server.
Single-user, no database, stores everything client-side.
"""
import io
import os
import re
import sys
import csv
import json
import string
import base64
import smtplib
import http.server
import socketserver
import urllib.parse

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

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
                return self.send_demo_response()

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            # Check if this is preview data (new format) or traditional data (legacy format)
            if 'emails' in data:
                return self.handle_preview_emails(data)
            else:
                return self.handle_traditional_emails(data)

        except Exception as e:
            self.send_json_response({'success': False, 'error': str(e)})

    def handle_preview_emails(self, data):
        """Handle preview mode - emails are already merged and validated by frontend"""
        try:
            emails = data.get('emails', [])
            attachments_data = data.get('attachments', {})

            # Get SMTP settings from client
            smtp_server = data.get('smtpServer', '')
            smtp_port = int(data.get('smtpPort', 587))
            smtp_user = data.get('smtpUser', '')
            smtp_password = data.get('smtpPassword', '')

            print(f"DEBUG: Preview mode - Processing {len(emails)} emails")
            print(f"DEBUG: SMTP settings - Server: {smtp_server}, Port: {smtp_port}, User: {smtp_user}")
            print(f"DEBUG: Available attachments: {len(attachments_data)}")

            if not emails:
                self.send_json_response({'success': False, 'error': 'No emails to send'})
                return

            # Send emails using pre-merged data
            results = []
            for i, email_data in enumerate(emails):
                try:
                    success = self.send_email_with_smtp_settings(
                        email_data.get('from', ''),
                        email_data.get('to', ''),
                        email_data.get('subject', ''),
                        email_data.get('body', ''),
                        email_data.get('attachments', []),
                        smtp_server,
                        smtp_port,
                        smtp_user,
                        smtp_password,
                        cc_email=email_data.get('cc', ''),
                        bcc_email=email_data.get('bcc', '')
                    )

                    results.append({
                        'email': email_data.get('to', ''),
                        '_rowNumber': i + 1,
                        'success': success,
                        'error': None if success else 'Failed to send'
                    })

                except Exception as e:
                    results.append({
                        'email': email_data.get('to', ''),
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
            self.send_json_response({'success': False, 'error': f'Preview mode error: {str(e)}'})

    def handle_traditional_emails(self, data):
        """Handle traditional mode - for backward compatibility"""
        # For now, redirect to preview mode or show deprecation message
        self.send_json_response({
            'success': False,
            'error': 'Traditional mode deprecated. Please use preview mode for sending emails.'
        })

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
        """Send demo response displaying demo mode"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            # Check if this is preview data or traditional data
            if 'emails' in data:
                # Handle preview format
                emails = data.get('emails', [])
                results = []
                for i, email_data in enumerate(emails):
                    results.append({
                        'email': email_data.get('to', f'Email {i + 1}'),
                        '_rowNumber': i + 1,
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
                # Handle traditional format for backward compatibility
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

    def identify_global_attachments(self, attachments_data, recipients, template):
        """Identify attachments that should be sent to all recipients (global attachments)"""
        global_attachments = {}
        referenced_attachments = set()

        # Collect all attachment references from CSV data
        for recipient in recipients:
            if 'attachment' in recipient and recipient['attachment'].strip():
                attachment_value = recipient['attachment'].strip()
                delimiter = ';'
                attachment_files = [f.strip() for f in attachment_value.split(delimiter) if f.strip()]

                for filename in attachment_files:
                    # Check for exact matches in attachments_data
                    for stored_filename in attachments_data.keys():
                        if (stored_filename == filename or
                            stored_filename.startswith(filename) or
                            filename.startswith(stored_filename) or
                            filename in stored_filename):
                            referenced_attachments.add(stored_filename)
                            break

        # Collect all attachment references from template patterns
        attachment_pattern = r'\{\{attachment:([^}]+)\}\}'
        matches = re.findall(attachment_pattern, template)

        for filename_template in matches:
            # Check each recipient to see what this template resolves to
            for recipient in recipients:
                merged_filename = self.merge_template(filename_template, recipient)

                # Check for matches in attachments_data
                for stored_filename in attachments_data.keys():
                    if (stored_filename == merged_filename or
                        stored_filename.startswith(merged_filename) or
                        merged_filename.startswith(stored_filename) or
                        merged_filename in stored_filename):
                        referenced_attachments.add(stored_filename)
                        break

        # Global attachments are those in attachments_data but not referenced
        for stored_filename, attachment_data in attachments_data.items():
            if stored_filename not in referenced_attachments:
                global_attachments[stored_filename] = attachment_data

        print(f"DEBUG: Referenced attachments: {list(referenced_attachments)}")
        return global_attachments

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

    def get_attachments_for_email(self, recipient, template, attachments_data, global_attachments=None):
        """Extract attachment references from template and return matching files"""
        email_attachments = []

        # Debug logging
        print(f"DEBUG: Processing attachments for recipient: {recipient}")
        print(f"DEBUG: Available attachments: {list(attachments_data.keys())}")
        if global_attachments:
            print(f"DEBUG: Global attachments to include: {list(global_attachments.keys())}")

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

        # NEW: Include global attachments that should be sent to all recipients
        if global_attachments:
            for global_filename, global_attachment_data in global_attachments.items():
                # Only include if not already added via CSV or template
                already_included = any(att['filename'] == global_filename for att in email_attachments)
                if not already_included:
                    try:
                        # Extract base64 data from data URL
                        data_url = global_attachment_data.get('data', '')
                        if ',' in data_url:
                            base64_data = data_url.split(',')[1]

                            email_attachments.append({
                                'filename': global_filename,
                                'data': base64_data,
                                'type': global_attachment_data.get('type', 'application/octet-stream')
                            })
                            print(f"DEBUG: Added global attachment: {global_filename}")
                        else:
                            print(f"DEBUG: Invalid data URL format for global attachment {global_filename}")
                    except Exception as e:
                        print(f"DEBUG: Error processing global attachment {global_filename}: {e}")

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

    def send_email_with_smtp_settings(self, from_email, to_email, subject, body, attachments, smtp_server, smtp_port, smtp_user, smtp_password, cc_email=None, bcc_email=None):
        """Send email with custom SMTP settings"""
        try:
            # Validate email addresses first
            if not self.is_valid_email(to_email):
                print(f"DEBUG: Invalid recipient email address: {to_email}")
                return False

            if not self.is_valid_email(from_email):
                print(f"DEBUG: Invalid sender email address: {from_email}")
                return False

            # Validate CC emails if provided
            if cc_email and not self.is_valid_email_list(cc_email):
                print(f"DEBUG: Invalid CC email address(es): {cc_email}")
                return False

            # Validate BCC emails if provided
            if bcc_email and not self.is_valid_email_list(bcc_email):
                print(f"DEBUG: Invalid BCC email address(es): {bcc_email}")
                return False

            msg = MIMEMultipart()
            msg['From'] = from_email
            msg['To'] = to_email
            msg['Subject'] = subject

            # Add CC and BCC headers if provided
            if cc_email:
                msg['Cc'] = cc_email
            if bcc_email:
                msg['Bcc'] = bcc_email

            # Attach HTML body
            msg.attach(MIMEText(body, 'html'))

            # Attach files
            for attachment in attachments:
                try:
                    # Extract base64 data from data URL
                    data_url = attachment.get('data', '')
                    if ',' in data_url:
                        base64_data = data_url.split(',')[1]
                    else:
                        base64_data = data_url

                    # Decode base64 data
                    file_data = base64.b64decode(base64_data)
                    print(f"DEBUG: Successfully decoded attachment {attachment.get('filename', 'unknown')} ({len(file_data)} bytes)")

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
            if cc_email:
                print(f"DEBUG: CC: {cc_email}")
            if bcc_email:
                print(f"DEBUG: BCC: {bcc_email}")

            server = smtplib.SMTP(smtp_server, smtp_port)
            server.set_debuglevel(1)  # Enable SMTP debugging

            try:
                server.starttls()
                server.login(smtp_user, smtp_password)

                # Build recipient list (To + CC + BCC)
                recipients = [to_email]
                if cc_email:
                    # Parse comma-separated CC emails
                    cc_list = [email.strip() for email in cc_email.split(',') if email.strip()]
                    recipients.extend(cc_list)
                if bcc_email:
                    # Parse comma-separated BCC emails
                    bcc_list = [email.strip() for email in bcc_email.split(',') if email.strip()]
                    recipients.extend(bcc_list)

                text = msg.as_string()
                server.sendmail(from_email, recipients, text)
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

    def is_valid_email_list(self, email_list):
        """Validate a comma-separated list of email addresses"""
        if not email_list or not email_list.strip():
            return True  # Empty list is valid

        emails = [email.strip() for email in email_list.split(',') if email.strip()]
        return all(self.is_valid_email(email) for email in emails)

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
