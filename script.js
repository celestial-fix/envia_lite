// Envialite - Personal Mail Merge Tool JavaScript

class EnvialiteApp {
    constructor() {
        // Email composition fields
        this.fromEmail = '';
        this.toEmail = '';
        this.ccEmail = '';
        this.bccEmail = '';
        this.emailSubject = '';
        this.emailBody = '';

        // Attachment fields
        this.consistentAttachments = []; // Selected files for all emails
        this.variableAttachments = ''; // Template variable like {{attachments}}
        this.attachmentDelimiter = ';'; // Delimiter for multiple files

        // Data fields
        this.csvData = '';
        this.recipients = [];
        this.attachments = new Map(); // Store attachments as Map(filename -> fileData)

        // SMTP settings
        this.smtpServer = 'smtp.gmail.com';
        this.smtpPort = 587;
        this.smtpUser = '';
        this.smtpPassword = '';

        // Preview navigation
        this.currentEmailIndex = 0;
        this.emailPreviews = []; // Store all generated email previews

        this.init();
    }

    init() {
        // Load saved data on startup
        this.loadData();
        this.loadAttachments();
        this.loadSmtpSettings();

        // Set up event listeners
        this.setupEventListeners();

        console.log('Envialite initialized');
    }

    setupEventListeners() {
        // Auto-save on input changes (debounced)
        let saveTimeout;
        const fieldsToWatch = [
            'fromEmail', 'toEmail', 'ccEmail', 'bccEmail',
            'emailSubject', 'emailBody', 'csvData'
        ];

        fieldsToWatch.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => {
                    clearTimeout(saveTimeout);
                    saveTimeout = setTimeout(() => this.saveData(), 1000);
                });
            }
        });
    }

    saveData() {
        const data = {
            // Email composition data
            fromEmail: document.getElementById('fromEmail').value,
            toEmail: document.getElementById('toEmail').value,
            ccEmail: document.getElementById('ccEmail').value,
            bccEmail: document.getElementById('bccEmail').value,
            emailSubject: document.getElementById('emailSubject').value,
            emailBody: document.getElementById('emailBody').value,

            // CSV data
            csvData: document.getElementById('csvData').value,

            // Attachment settings
            variableAttachments: document.getElementById('variableAttachments').value,
            attachmentDelimiter: document.getElementById('attachmentDelimiter').value,

            timestamp: new Date().toISOString()
        };

        localStorage.setItem('envialite_data', JSON.stringify(data));
        this.showStatus('Data saved to browser', 'success');
    }

    loadData() {
        try {
            const saved = localStorage.getItem('envialite_data');
            if (saved) {
                const data = JSON.parse(saved);

                // Load email composition data
                document.getElementById('fromEmail').value = data.fromEmail || '';
                document.getElementById('toEmail').value = data.toEmail || '';
                document.getElementById('ccEmail').value = data.ccEmail || '';
                document.getElementById('bccEmail').value = data.bccEmail || '';
                document.getElementById('emailSubject').value = data.emailSubject || '';
                document.getElementById('emailBody').value = data.emailBody || '';

                // Load CSV data
                document.getElementById('csvData').value = data.csvData || '';

                // Load attachment settings
                document.getElementById('variableAttachments').value = data.variableAttachments || '';
                document.getElementById('attachmentDelimiter').value = data.attachmentDelimiter || '';

                // Update instance variables
                this.fromEmail = data.fromEmail || '';
                this.toEmail = data.toEmail || '';
                this.ccEmail = data.ccEmail || '';
                this.bccEmail = data.bccEmail || '';
                this.emailSubject = data.emailSubject || '';
                this.emailBody = data.emailBody || '';
                this.csvData = data.csvData || '';
                this.variableAttachments = data.variableAttachments || '';
                this.attachmentDelimiter = data.attachmentDelimiter || ';';

                this.showStatus('Data loaded from browser', 'success');
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    parseCSV() {
        try {
            const lines = this.csvData.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('CSV must have at least a header row and one data row');
            }

            const headers = lines[0].split(',').map(h => h.trim());
            this.recipients = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values.length === headers.length && values.some(v => v)) {
                    const recipient = {};
                    headers.forEach((header, index) => {
                        recipient[header] = values[index] || '';
                    });

                    // Add row number for reference
                    recipient._rowNumber = i;

                    this.recipients.push(recipient);
                }
            }

            if (this.recipients.length === 0) {
                throw new Error('No data rows found in CSV. Please check your CSV format.');
            }

            return this.recipients;
        } catch (error) {
            throw new Error(`CSV parsing error: ${error.message}`);
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    mergeTemplate(template, variables) {
        try {
            // Simple variable replacement: {{variable}} -> value
            let result = template;
            for (const [key, value] of Object.entries(variables)) {
                const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                result = result.replace(regex, value || '');
            }
            return result;
        } catch (error) {
            console.error('Template merge error:', error);
            return template;
        }
    }

    async previewEmails() {
        try {
            this.getFormData();
            this.parseCSV();

            if (this.recipients.length === 0) {
                this.showStatus('No valid recipients to preview', 'error');
                return;
            }

            // Generate detailed previews for all emails
            this.generateEmailPreviews();

            // Show the first email
            this.currentEmailIndex = 0;
            this.showCurrentEmailPreview();

            document.getElementById('previewSection').style.display = 'block';
            document.getElementById('resultsSection').style.display = 'none';

            this.showStatus(`Preview generated for ${this.recipients.length} emails`, 'success');

        } catch (error) {
            this.showStatus(error.message, 'error');
        }
    }

    generateEmailPreviews() {
        this.emailPreviews = [];

        this.recipients.forEach((recipient, index) => {
            const mergedFrom = this.mergeTemplate(this.fromEmail, recipient);
            const mergedTo = this.mergeTemplate(this.toEmail, recipient);
            const mergedCc = this.mergeTemplate(this.ccEmail, recipient);
            const mergedBcc = this.mergeTemplate(this.bccEmail, recipient);
            const mergedSubject = this.mergeTemplate(this.emailSubject, recipient);
            const mergedBody = this.mergeTemplate(this.emailBody, recipient);

            // Get attachments for this email
            const emailAttachments = this.getAttachmentsForEmail(recipient);

            this.emailPreviews.push({
                index: index,
                recipient: recipient,
                from: mergedFrom,
                to: mergedTo,
                cc: mergedCc,
                bcc: mergedBcc,
                subject: mergedSubject,
                body: mergedBody,
                attachments: emailAttachments
            });
        });
    }

    showCurrentEmailPreview() {
        const preview = this.emailPreviews[this.currentEmailIndex];
        if (!preview) return;

        const previewContent = document.getElementById('previewContent');
        const emailCounter = document.getElementById('emailCounter');
        const prevBtn = document.getElementById('prevEmail');
        const nextBtn = document.getElementById('nextEmail');

        // Update navigation buttons
        prevBtn.disabled = this.currentEmailIndex === 0;
        nextBtn.disabled = this.currentEmailIndex === this.emailPreviews.length - 1;

        // Update counter
        emailCounter.textContent = `Email ${this.currentEmailIndex + 1} of ${this.emailPreviews.length}`;

        // Generate detailed email preview
        const recipientInfo = preview.recipient.email ?
            `To: ${preview.recipient.name || preview.recipient.email}` :
            `Row ${preview.recipient._rowNumber}: ${preview.recipient.name || 'No name column'}`;

        let attachmentsHtml = '';
        if (preview.attachments.length > 0) {
            attachmentsHtml = `
                <div class="preview-email-attachments">
                    <h4>📎 Attachments (${preview.attachments.length}):</h4>
                    <ul>
                        ${preview.attachments.map(att => `<li>${att.filename} (${this.formatFileSize(att.size || 0)})</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        previewContent.innerHTML = `
            <div class="preview-email">
                <div class="preview-email-header">
                    <div class="preview-email-field"><strong>From:</strong> ${this.escapeHtml(preview.from)}</div>
                    <div class="preview-email-field"><strong>To:</strong> ${this.escapeHtml(preview.to)}</div>
                    ${preview.cc ? `<div class="preview-email-field"><strong>CC:</strong> ${this.escapeHtml(preview.cc)}</div>` : ''}
                    ${preview.bcc ? `<div class="preview-email-field"><strong>BCC:</strong> ${this.escapeHtml(preview.bcc)}</div>` : ''}
                    <div class="preview-email-field"><strong>Subject:</strong> ${this.escapeHtml(preview.subject)}</div>
                </div>

                <div class="preview-email-body">
                    <strong>Message:</strong><br>
                    ${preview.body.replace(/\n/g, '<br>')}
                </div>

                ${attachmentsHtml}
            </div>
        `;
    }

    navigateEmail(direction) {
        const newIndex = this.currentEmailIndex + direction;
        if (newIndex >= 0 && newIndex < this.emailPreviews.length) {
            this.currentEmailIndex = newIndex;
            this.showCurrentEmailPreview();
        }
    }

    getAttachmentsForEmail(recipient) {
        const attachments = [];

        // Get consistent attachments (selected in dropdown)
        const selectedAttachments = document.getElementById('emailAttachments');
        for (let i = 0; i < selectedAttachments.options.length; i++) {
            const option = selectedAttachments.options[i];
            if (option.selected && option.value) {
                const fileData = this.attachments.get(option.value);
                if (fileData) {
                    attachments.push({
                        filename: option.value,
                        size: fileData.size,
                        type: fileData.type
                    });
                }
            }
        }

        // Get variable attachments from CSV
        if (this.variableAttachments) {
            const varAttachments = this.getVariableAttachmentsForEmail(recipient);
            attachments.push(...varAttachments);
        }

        return attachments;
    }

    getVariableAttachmentsForEmail(recipient) {
        const attachments = [];

        if (!this.variableAttachments) return attachments;

        // Merge the variable attachments template
        const mergedVarAttachments = this.mergeTemplate(this.variableAttachments, recipient);

        if (mergedVarAttachments) {
            // Split by delimiter if provided
            const delimiter = this.attachmentDelimiter || ';';
            const filenames = mergedVarAttachments.split(delimiter).map(f => f.trim()).filter(f => f);

            filenames.forEach(filename => {
                // Look for the attachment
                let foundAttachment = this.attachments.get(filename);

                if (!foundAttachment) {
                    // Try pattern matching
                    for (const [name, data] of this.attachments) {
                        if (name.includes(filename) || filename.includes(name)) {
                            foundAttachment = data;
                            break;
                        }
                    }
                }

                if (foundAttachment) {
                    attachments.push({
                        filename: filename,
                        size: foundAttachment.size,
                        type: foundAttachment.type
                    });
                }
            });
        }

        return attachments;
    }

    async sendEmails() {
        try {
            this.getFormData();

            if (!this.fromEmail) {
                this.showStatus('Please enter your email address', 'error');
                return;
            }

            this.parseCSV();

            if (this.recipients.length === 0) {
                this.showStatus('No valid recipients to send to', 'error');
                return;
            }

            // Add loading state
            this.setLoading(true);

            // Get SMTP settings before sending
            this.getSmtpSettings();

            // Debug logging for email sending
            console.log('Sending emails with data:', {
                recipientsCount: this.recipients.length,
                fromEmail: this.fromEmail,
                hasAttachments: this.attachments.size > 0,
                attachments: Array.from(this.attachments.keys()),
                smtpServer: this.smtpServer,
                smtpPort: this.smtpPort,
                smtpUser: this.smtpUser,
                csvData: this.csvData.substring(0, 200) + '...'
            });

            const response = await fetch('/send-emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    template: this.template,
                    csvData: this.csvData,
                    subject: this.subject,
                    fromEmail: this.fromEmail,
                    attachments: Object.fromEntries(this.attachments),
                    // Include SMTP settings
                    smtpServer: this.smtpServer,
                    smtpPort: this.smtpPort,
                    smtpUser: this.smtpUser,
                    smtpPassword: this.smtpPassword
                })
            });

            let result;
            try {
                const responseText = await response.text();
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                this.setLoading(false);
                this.showStatus(`Server error: Invalid JSON response`, 'error');
                return;
            }

            this.setLoading(false);

            if (result.success) {
                this.displayResults(result.results, result.summary);
                this.showStatus(result.summary, 'success');
            } else {
                this.showStatus(result.error, 'error');
            }

        } catch (error) {
            this.setLoading(false);
            this.showStatus(`Error sending emails: ${error.message}`, 'error');
        }
    }

    displayResults(results, summary) {
        const resultsContent = document.getElementById('resultsContent');
        resultsContent.innerHTML = '';

        // Summary
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'result-item success';
        summaryDiv.innerHTML = `<div class="result-summary"><strong>${summary}</strong></div>`;
        resultsContent.appendChild(summaryDiv);

        // Individual results
        results.forEach(result => {
            const resultDiv = document.createElement('div');
            resultDiv.className = `result-item ${result.success ? 'success' : 'error'}`;

            const statusIcon = result.success ? '✅' : '❌';
            const errorText = result.error ? `<div class="result-error">Error: ${result.error}</div>` : '';

            // Handle cases where there's no email column
            const resultIdentifier = result.email || `Row ${result._rowNumber || 'Unknown'}`;
            resultDiv.innerHTML = `
                <div class="result-email">${statusIcon} ${resultIdentifier}</div>
                <div class="result-status">${result.success ? 'Sent successfully' : 'Failed to send'}</div>
                ${errorText}
            `;

            resultsContent.appendChild(resultDiv);
        });

        document.getElementById('resultsSection').style.display = 'block';
        document.getElementById('previewSection').style.display = 'none';
    }

    getFormData() {
        // Get email composition data
        this.fromEmail = document.getElementById('fromEmail').value;
        this.toEmail = document.getElementById('toEmail').value;
        this.ccEmail = document.getElementById('ccEmail').value;
        this.bccEmail = document.getElementById('bccEmail').value;
        this.emailSubject = document.getElementById('emailSubject').value;
        this.emailBody = document.getElementById('emailBody').value;

        // Get CSV data
        this.csvData = document.getElementById('csvData').value;

        // Get attachment settings
        this.variableAttachments = document.getElementById('variableAttachments').value;
        this.attachmentDelimiter = document.getElementById('attachmentDelimiter').value || ';';

        // For backward compatibility, set template and subject
        this.template = this.emailBody;
        this.subject = this.emailSubject;
    }

    setLoading(loading) {
        const sendBtn = document.getElementById('sendBtn');
        const previewBtn = document.getElementById('previewBtn');

        if (loading) {
            sendBtn.innerHTML = '<span class="spinner"></span>Sending...';
            sendBtn.disabled = true;
            previewBtn.disabled = true;
            document.body.classList.add('loading');
        } else {
            sendBtn.innerHTML = '🚀 Send Emails';
            sendBtn.disabled = false;
            previewBtn.disabled = false;
            document.body.classList.remove('loading');
        }
    }

    showStatus(message, type) {
        // Remove existing status
        const existingStatus = document.querySelector('.status-message');
        if (existingStatus) {
            existingStatus.remove();
        }

        // Create new status message
        const statusDiv = document.createElement('div');
        statusDiv.className = `status-message ${type}`;
        statusDiv.innerHTML = `
            <div class="${type}" style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
                color: ${type === 'success' ? '#155724' : '#721c24'};
                border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
                border-radius: 4px;
                padding: 12px 16px;
                z-index: 1000;
                max-width: 300px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ">
                ${message}
            </div>
        `;

        document.body.appendChild(statusDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (statusDiv.parentNode) {
                statusDiv.remove();
            }
        }, 5000);
    }

    // SMTP Settings Management
    saveSmtpSettings() {
        const settings = {
            smtpServer: document.getElementById('smtpServer').value,
            smtpPort: parseInt(document.getElementById('smtpPort').value) || 587,
            smtpUser: document.getElementById('smtpUser').value,
            smtpPassword: document.getElementById('smtpPassword').value,
            fromEmail: document.getElementById('fromEmail').value,
            fromName: document.getElementById('fromName').value,
            defaultSubject: document.getElementById('defaultSubject').value,
            timestamp: new Date().toISOString()
        };

        localStorage.setItem('envialite_smtp_settings', JSON.stringify(settings));
        this.showStatus('SMTP settings saved', 'success');
    }

    loadSmtpSettings() {
        try {
            const saved = localStorage.getItem('envialite_smtp_settings');
            if (saved) {
                const settings = JSON.parse(saved);

                document.getElementById('smtpServer').value = settings.smtpServer || 'smtp.gmail.com';
                document.getElementById('smtpPort').value = settings.smtpPort || 587;
                document.getElementById('smtpUser').value = settings.smtpUser || '';
                document.getElementById('smtpPassword').value = settings.smtpPassword || '';
                document.getElementById('fromEmail').value = settings.fromEmail || '';
                document.getElementById('fromName').value = settings.fromName || '';
                document.getElementById('defaultSubject').value = settings.defaultSubject || '';

                // Update instance variables
                this.smtpServer = settings.smtpServer || 'smtp.gmail.com';
                this.smtpPort = settings.smtpPort || 587;
                this.smtpUser = settings.smtpUser || '';
                this.smtpPassword = settings.smtpPassword || '';
                this.fromEmail = settings.fromEmail || '';
                this.fromName = settings.fromName || '';
                this.subject = settings.defaultSubject || '';
            }
        } catch (error) {
            console.error('Error loading SMTP settings:', error);
        }
    }

    async testSmtpConnection() {
        try {
            this.getSmtpSettings();

            if (!this.smtpServer || !this.smtpUser || !this.smtpPassword) {
                this.showStatus('Please fill in all SMTP settings', 'error');
                return;
            }

            const testResult = document.getElementById('smtpTestResult');
            testResult.innerHTML = '<span style="color: #ffc107;">Testing...</span>';

            const response = await fetch('/test-smtp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    smtpServer: this.smtpServer,
                    smtpPort: this.smtpPort,
                    smtpUser: this.smtpUser,
                    smtpPassword: this.smtpPassword
                })
            });

            let result;
            try {
                const responseText = await response.text();
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                testResult.innerHTML = '<span style="color: #dc3545;">❌ Invalid response</span>';
                this.showStatus(`Server error: Invalid JSON response`, 'error');
                return;
            }

            if (result.success) {
                testResult.innerHTML = '<span style="color: #28a745;">✅ Connection successful!</span>';
                this.showStatus('SMTP connection test passed', 'success');
            } else {
                testResult.innerHTML = '<span style="color: #dc3545;">❌ Connection failed</span>';
                this.showStatus(`SMTP test failed: ${result.error}`, 'error');
            }

        } catch (error) {
            document.getElementById('smtpTestResult').innerHTML = '<span style="color: #dc3545;">❌ Test failed</span>';
            this.showStatus(`SMTP test error: ${error.message}`, 'error');
        }
    }

    getSmtpSettings() {
        const smtpServerField = document.getElementById('smtpServer');
        const smtpPortField = document.getElementById('smtpPort');
        const smtpUserField = document.getElementById('smtpUser');
        const smtpPasswordField = document.getElementById('smtpPassword');
        const fromEmailField = document.getElementById('fromEmail');
        const fromNameField = document.getElementById('fromName');
        const defaultSubjectField = document.getElementById('defaultSubject');

        this.smtpServer = smtpServerField ? smtpServerField.value : 'smtp.gmail.com';
        this.smtpPort = smtpPortField ? parseInt(smtpPortField.value) || 587 : 587;
        this.smtpUser = smtpUserField ? smtpUserField.value : '';
        this.smtpPassword = smtpPasswordField ? smtpPasswordField.value : '';
        this.fromEmail = fromEmailField ? fromEmailField.value : '';
        this.fromName = fromNameField ? fromNameField.value : '';
        this.subject = defaultSubjectField ? defaultSubjectField.value : '';
    }

    // Attachment Management Methods
    async uploadFiles() {
        const fileInput = document.getElementById('fileUpload');
        const files = fileInput.files;

        if (files.length === 0) {
            this.showStatus('Please select files to upload', 'error');
            return;
        }

        let uploadedCount = 0;
        let errorCount = 0;

        for (const file of files) {
            try {
                if (file.size > 10 * 1024 * 1024) { // 10MB limit
                    throw new Error(`File ${file.name} is too large (max 10MB)`);
                }

                await this.addAttachment(file);
                uploadedCount++;
            } catch (error) {
                console.error(`Error uploading ${file.name}:`, error);
                errorCount++;
            }
        }

        this.displayAttachments();
        this.saveAttachments();
        this.populateAttachmentsDropdown();

        const message = `Uploaded ${uploadedCount} files`;
        if (errorCount > 0) {
            message += `, ${errorCount} failed`;
        }
        this.showStatus(message, errorCount > 0 ? 'error' : 'success');

        // Clear file input
        fileInput.value = '';
    }

    async addAttachment(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const fileData = {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        data: e.target.result, // Base64 data URL
                        uploadedAt: new Date().toISOString()
                    };

                    this.attachments.set(file.name, fileData);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    deleteAttachment(filename) {
        if (this.attachments.has(filename)) {
            this.attachments.delete(filename);
            this.displayAttachments();
            this.saveAttachments();
            this.populateAttachmentsDropdown();
            this.showStatus(`Deleted ${filename}`, 'success');
        }
    }

    populateAttachmentsDropdown() {
        const dropdown = document.getElementById('emailAttachments');
        if (!dropdown) return;

        // Clear existing options (except the first one)
        while (dropdown.children.length > 1) {
            dropdown.removeChild(dropdown.lastChild);
        }

        // Add options for each uploaded file
        for (const [filename, fileData] of this.attachments) {
            const option = document.createElement('option');
            option.value = filename;
            option.textContent = `${filename} (${this.formatFileSize(fileData.size)})`;
            dropdown.appendChild(option);
        }
    }

    displayAttachments() {
        const container = document.getElementById('attachmentsContent');

        if (this.attachments.size === 0) {
            container.innerHTML = '<p style="color: #666; font-style: italic;">No files uploaded yet</p>';
            return;
        }

        container.innerHTML = '';

        for (const [filename, fileData] of this.attachments) {
            const item = document.createElement('div');
            item.className = 'attachment-item';

            const icon = this.getFileIcon(filename);
            const sizeFormatted = this.formatFileSize(fileData.size);

            item.innerHTML = `
                <div class="attachment-icon">${icon}</div>
                <div class="attachment-info">
                    <div class="attachment-name">${this.escapeHtml(filename)}</div>
                    <div class="attachment-details">
                        <span class="attachment-size">${sizeFormatted}</span>
                        <span style="margin-left: 10px; color: #666;">${fileData.type || 'Unknown type'}</span>
                    </div>
                </div>
                <div class="attachment-actions">
                    <button class="btn-small" onclick="downloadAttachment('${filename}')" title="Download">
                        📥
                    </button>
                    <button class="btn-small btn-delete" onclick="deleteAttachment('${filename}')" title="Delete">
                        🗑️
                    </button>
                </div>
            `;

            container.appendChild(item);
        }
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const icons = {
            'pdf': '📄',
            'doc': '📝',
            'docx': '📝',
            'txt': '📄',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'png': '🖼️',
            'gif': '🖼️'
        };
        return icons[ext] || '📎';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    downloadAttachment(filename) {
        const fileData = this.attachments.get(filename);
        if (!fileData) return;

        const link = document.createElement('a');
        link.href = fileData.data;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    saveAttachments() {
        try {
            const attachmentsArray = Array.from(this.attachments.entries());
            localStorage.setItem('envialite_attachments', JSON.stringify(attachmentsArray));
        } catch (error) {
            console.error('Error saving attachments:', error);
            this.showStatus('Error saving attachments', 'error');
        }
    }

    loadAttachments() {
        try {
            const saved = localStorage.getItem('envialite_attachments');
            if (saved) {
                const attachmentsArray = JSON.parse(saved);
                this.attachments = new Map(attachmentsArray);
                this.displayAttachments();
                this.populateAttachmentsDropdown();
            }
        } catch (error) {
            console.error('Error loading attachments:', error);
        }
    }

    getAttachmentForEmail(recipient, template) {
        // Extract attachment references from template
        const attachmentMatches = template.match(/\{\{attachment:([^}]+)\}\}/g);
        if (!attachmentMatches) return [];

        const attachments = [];

        for (const match of attachmentMatches) {
            const filenameTemplate = match.match(/\{\{attachment:([^}]+)\}\}/)[1];
            const mergedFilename = this.mergeTemplate(filenameTemplate, recipient);

            // Look for exact match first, then try pattern matching
            let foundAttachment = this.attachments.get(mergedFilename);

            if (!foundAttachment) {
                // Try to find attachment that starts with merged filename
                for (const [name, data] of this.attachments) {
                    if (name.includes(mergedFilename) || mergedFilename.includes(name)) {
                        foundAttachment = data;
                        break;
                    }
                }
            }

            if (foundAttachment) {
                attachments.push({
                    filename: mergedFilename,
                    data: foundAttachment.data,
                    type: foundAttachment.type
                });
            }
        }

        return attachments;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.envialiteApp = new EnvialiteApp();
});

// Tab functionality
function showTab(tabName) {
    // Hide all tab cards
    const tabCards = document.querySelectorAll('.tab-card');
    tabCards.forEach(card => {
        card.classList.remove('active');
    });

    // Remove active class from all tab buttons
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab card
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Add active class to clicked button
    event.target.classList.add('active');
}

// Global functions for HTML onclick handlers
function previewEmails() {
    window.envialiteApp.previewEmails();
}

function sendEmails() {
    window.envialiteApp.sendEmails();
}

function saveData() {
    window.envialiteApp.saveData();
}

function loadData() {
    window.envialiteApp.loadData();
}

function uploadFiles() {
    window.envialiteApp.uploadFiles();
}

function deleteAttachment(filename) {
    window.envialiteApp.deleteAttachment(filename);
}

function downloadAttachment(filename) {
    window.envialiteApp.downloadAttachment(filename);
}

function testSmtpConnection() {
    window.envialiteApp.testSmtpConnection();
}

function navigateEmail(direction) {
    window.envialiteApp.navigateEmail(direction);
}
