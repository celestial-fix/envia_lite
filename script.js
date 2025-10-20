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

        // Initialize table editor
        this.initializeTableEditor();

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

        // Initialize currentPreviewAttachments as empty Map
        this.currentPreviewAttachments = new Map();

        // Check if SMTP username is a valid email for fallback
        const smtpEmailFallback = this.isValidEmail(this.smtpUser) ? this.smtpUser : null;
        if (this.smtpUser && !smtpEmailFallback) {
            this.showStatus('Warning: SMTP username does not appear to be an email address. From field may be empty.', 'error');
        }

        this.recipients.forEach((recipient, index) => {
            let mergedFrom = this.mergeTemplate(this.fromEmail, recipient);
            const mergedTo = this.mergeTemplate(this.toEmail, recipient);
            const mergedCc = this.mergeTemplate(this.ccEmail, recipient);
            const mergedBcc = this.mergeTemplate(this.bccEmail, recipient);
            const mergedSubject = this.mergeTemplate(this.emailSubject, recipient);
            const mergedBody = this.mergeTemplate(this.emailBody, recipient);

            // Use SMTP username as fallback if no From email is provided
            if (!mergedFrom && smtpEmailFallback) {
                mergedFrom = smtpEmailFallback;
                console.log(`Using SMTP username as From email for recipient ${index + 1}`);
            }

            // Get attachments for this email (without emailIndex to avoid preview-specific logic)
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

        // Update navigation buttons
        const prevBtn = document.getElementById('prevEmail');
        const nextBtn = document.getElementById('nextEmail');
        const emailCounter = document.getElementById('emailCounter');

        prevBtn.disabled = this.currentEmailIndex === 0;
        nextBtn.disabled = this.currentEmailIndex === this.emailPreviews.length - 1;

        // Update email counter with status
        const totalCount = this.emailPreviews.length;
        let counterText = `Email ${this.currentEmailIndex + 1} of ${totalCount}`;

        // Add status if email was sent
        if (preview.sendStatus === 'sent') {
            counterText += ' - ✅ Sent';
        } else if (preview.sendStatus === 'failed') {
            counterText += ' - ❌ Failed';
        }

        emailCounter.textContent = counterText;

        // Populate editable fields with merged content (variables replaced)
        this.populateEditablePreview(preview);

        // Populate the attachment picker with available attachments
        this.populateAttachmentPicker();

        // Store original template values for reset functionality
        this.currentPreviewOriginal = {
            from: this.fromEmail, // Store original template
            to: this.toEmail,
            cc: this.ccEmail,
            bcc: this.bccEmail,
            subject: this.emailSubject,
            body: this.emailBody,
            attachments: [...preview.attachments]
        };

        // Initialize preview attachments management
        this.currentPreviewAttachments = new Map();
        preview.attachments.forEach(att => {
            this.currentPreviewAttachments.set(att.filename, att);
        });

        this.displayPreviewAttachments();

        // Show status indicator if email was sent
        this.showEmailStatus(preview);
    }

    populateAttachmentPicker() {
        const picker = document.getElementById('previewAttachmentPicker');
        if (!picker) return;

        // Clear existing options (except the first one)
        while (picker.children.length > 1) {
            picker.removeChild(picker.lastChild);
        }

        // Add options for each available attachment
        for (const [filename, fileData] of this.attachments) {
            // Check if this attachment is already in the current preview
            const alreadyInPreview = this.currentPreviewAttachments.has(filename);

            if (!alreadyInPreview) {
                const option = document.createElement('option');
                option.value = filename;
                option.textContent = `${filename} (${this.formatFileSize(fileData.size)})`;
                picker.appendChild(option);
            }
        }

        // Reset the picker to default option
        picker.value = '';
    }

    addAttachmentFromPicker() {
        const picker = document.getElementById('previewAttachmentPicker');
        const selectedFilename = picker.value;

        if (!selectedFilename) return;

        // Get the attachment data
        const fileData = this.attachments.get(selectedFilename);
        if (!fileData) {
            console.error('Attachment data not found for:', selectedFilename);
            return;
        }

        console.log('Adding attachment to email:', {
            filename: selectedFilename,
            currentEmailIndex: this.currentEmailIndex,
            currentPreviewAttachmentsSize: this.currentPreviewAttachments.size,
            emailPreviewsLength: this.emailPreviews.length
        });

        // Add to current preview attachments
        this.currentPreviewAttachments.set(selectedFilename, fileData);

        // Also update the email preview object with the new attachment
        const currentPreview = this.emailPreviews[this.currentEmailIndex];
        if (currentPreview) {
            // Add the attachment data to the preview object
            currentPreview.attachments = Array.from(this.currentPreviewAttachments.values());
            console.log('Updated email preview object with attachments:', currentPreview.attachments.length);
        } else {
            console.error('Current preview not found!');
        }

        // Refresh the display
        this.displayPreviewAttachments();
        this.populateAttachmentPicker(); // Refresh to remove the added option

        this.showStatus(`Added ${selectedFilename} to email`, 'success');
    }

    populateEditablePreview(preview) {
        document.getElementById('previewFrom').value = preview.from || '';
        document.getElementById('previewTo').value = preview.to || '';
        document.getElementById('previewCc').value = preview.cc || '';
        document.getElementById('previewBcc').value = preview.bcc || '';
        document.getElementById('previewSubject').value = preview.subject || '';
        document.getElementById('previewBody').value = preview.body || '';
    }

    savePreviewChanges() {
        const preview = this.emailPreviews[this.currentEmailIndex];
        if (!preview) return;

        // Get edited values
        const editedFrom = document.getElementById('previewFrom').value;
        const editedTo = document.getElementById('previewTo').value;
        const editedCc = document.getElementById('previewCc').value;
        const editedBcc = document.getElementById('previewBcc').value;
        const editedSubject = document.getElementById('previewSubject').value;
        const editedBody = document.getElementById('previewBody').value;

        // Update the preview object
        preview.from = editedFrom;
        preview.to = editedTo;
        preview.cc = editedCc;
        preview.bcc = editedBcc;
        preview.subject = editedSubject;
        preview.body = editedBody;

        // Update attachments
        preview.attachments = Array.from(this.currentPreviewAttachments.values());

        // Update the CSV data if this is based on a CSV row
        if (preview.recipient) {
            this.updateCSVFromPreviewChanges(preview);
        }

        this.showStatus('Preview changes saved', 'success');
    }

    refreshPreviewVariables() {
        const preview = this.emailPreviews[this.currentEmailIndex];
        if (!preview || !preview.recipient) return;

        // Get current field values (which might contain variables)
        const currentFrom = document.getElementById('previewFrom').value;
        const currentTo = document.getElementById('previewTo').value;
        const currentCc = document.getElementById('previewCc').value;
        const currentBcc = document.getElementById('previewBcc').value;
        const currentSubject = document.getElementById('previewSubject').value;
        const currentBody = document.getElementById('previewBody').value;

        // Re-merge with current CSV data
        const refreshedFrom = this.mergeTemplate(currentFrom, preview.recipient);
        const refreshedTo = this.mergeTemplate(currentTo, preview.recipient);
        const refreshedCc = this.mergeTemplate(currentCc, preview.recipient);
        const refreshedBcc = this.mergeTemplate(currentBcc, preview.recipient);
        const refreshedSubject = this.mergeTemplate(currentSubject, preview.recipient);
        const refreshedBody = this.mergeTemplate(currentBody, preview.recipient);

        // Update the preview object and display
        preview.from = refreshedFrom;
        preview.to = refreshedTo;
        preview.cc = refreshedCc;
        preview.bcc = refreshedBcc;
        preview.subject = refreshedSubject;
        preview.body = refreshedBody;

        // Update display fields
        this.populateEditablePreview(preview);

        this.showStatus('Variables refreshed from CSV data', 'success');
    }

    resetPreviewToOriginal() {
        const original = this.currentPreviewOriginal;
        if (!original) return;

        // Reset form fields
        document.getElementById('previewFrom').value = original.from || '';
        document.getElementById('previewTo').value = original.to || '';
        document.getElementById('previewCc').value = original.cc || '';
        document.getElementById('previewBcc').value = original.bcc || '';
        document.getElementById('previewSubject').value = original.subject || '';
        document.getElementById('previewBody').value = original.body || '';

        // Reset attachments
        this.currentPreviewAttachments = new Map();
        original.attachments.forEach(att => {
            this.currentPreviewAttachments.set(att.filename, att);
        });
        this.displayPreviewAttachments();

        this.showStatus('Preview reset to original', 'success');
    }

    updateCSVFromPreviewChanges(preview) {
        // This would update the CSV data based on preview changes
        // For now, we'll just update the CSV data in memory
        this.updateCSVFromTable();
    }

    async uploadPreviewFiles() {
        const fileInput = document.getElementById('previewFileUpload');
        const files = fileInput.files;

        if (files.length === 0) {
            this.showStatus('Please select files to upload', 'error');
            return;
        }

        let uploadedCount = 0;
        for (const file of files) {
            try {
                if (file.size > 10 * 1024 * 1024) { // 10MB limit
                    throw new Error(`File ${file.name} is too large (max 10MB)`);
                }

                await this.addPreviewAttachment(file);
                uploadedCount++;
            } catch (error) {
                console.error(`Error uploading ${file.name}:`, error);
                this.showStatus(`Error uploading ${file.name}: ${error.message}`, 'error');
            }
        }

        this.displayPreviewAttachments();

        if (uploadedCount > 0) {
            this.showStatus(`Uploaded ${uploadedCount} files to preview`, 'success');
        }

        // Clear file input
        fileInput.value = '';
    }

    async addPreviewAttachment(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const base64Data = e.target.result; // Full data URL like "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."

                    // Validate base64 format
                    if (!base64Data || !base64Data.includes(',')) {
                        throw new Error('Invalid file data format');
                    }

                    const fileData = {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        data: base64Data, // Keep full data URL
                        uploadedAt: new Date().toISOString()
                    };

                    console.log('File data created:', {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        dataLength: base64Data.length,
                        dataPrefix: base64Data.substring(0, 50) + '...'
                    });

                    // Add to both preview attachments and main attachments
                    this.currentPreviewAttachments.set(file.name, fileData);
                    this.attachments.set(file.name, fileData);

                    // Refresh the main attachments display and dropdown
                    this.displayAttachments();
                    this.populateAttachmentsDropdown();

                    resolve();
                } catch (error) {
                    console.error('Error processing file:', error);
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    displayPreviewAttachments() {
        const container = document.getElementById('previewAttachmentsList');
        container.innerHTML = '';

        if (this.currentPreviewAttachments.size === 0) {
            container.innerHTML = '<p style="color: #666; font-style: italic; margin: 0;">No attachments</p>';
            return;
        }

        for (const [filename, fileData] of this.currentPreviewAttachments) {
            const item = document.createElement('div');
            item.className = 'preview-attachment-item';

            const icon = this.getFileIcon(filename);
            const sizeFormatted = this.formatFileSize(fileData.size);

            item.innerHTML = `
                <div class="preview-attachment-icon">${icon}</div>
                <div class="preview-attachment-info">
                    <div class="preview-attachment-name">${this.escapeHtml(filename)}</div>
                    <div class="preview-attachment-details">${sizeFormatted} • ${fileData.type || 'Unknown type'}</div>
                </div>
                <div class="preview-attachment-actions">
                    <button class="btn-small" onclick="removePreviewAttachment('${filename}')" title="Remove">🗑️</button>
                </div>
            `;

            container.appendChild(item);
        }
    }

    removePreviewAttachment(filename) {
        if (this.currentPreviewAttachments.has(filename)) {
            this.currentPreviewAttachments.delete(filename);
            this.displayPreviewAttachments();
            this.showStatus(`Removed ${filename} from preview`, 'success');
        }
    }

    navigateEmail(direction) {
        const newIndex = this.currentEmailIndex + direction;
        if (newIndex >= 0 && newIndex < this.emailPreviews.length) {
            this.currentEmailIndex = newIndex;
            this.showCurrentEmailPreview();
        }
    }

    storeSendResults(results) {
        // Match server results with preview objects and store status
        results.forEach(result => {
            // Find the corresponding preview by email address and row number
            const matchingPreview = this.emailPreviews.find(preview =>
                preview.to === result.email ||
                preview.recipient._rowNumber === result._rowNumber
            );

            if (matchingPreview) {
                matchingPreview.sendStatus = result.success ? 'sent' : 'failed';
                matchingPreview.sendError = result.error;
            }
        });
    }

    refreshPreviewDisplay() {
        // Simplified - just update the basic counter
        const totalCount = this.emailPreviews.length;
        const emailCounter = document.getElementById('emailCounter');
        if (emailCounter) {
            emailCounter.textContent = `Email ${this.currentEmailIndex + 1} of ${totalCount}`;
        }
    }

    showEmailStatus(preview) {
        // Remove existing status indicators
        const existingStatus = document.querySelector('.email-status-indicator');
        if (existingStatus) {
            existingStatus.remove();
        }

        // Add status indicator if email was sent
        if (preview.sendStatus) {
            const statusDiv = document.createElement('div');
            statusDiv.className = 'email-status-indicator';

            if (preview.sendStatus === 'sent') {
                statusDiv.innerHTML = `
                    <div class="status-indicator sent" style="
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        background: #d4edda;
                        color: #155724;
                        border: 1px solid #c3e6cb;
                        border-radius: 20px;
                        padding: 4px 8px;
                        font-size: 12px;
                        font-weight: bold;
                        z-index: 100;
                    ">
                        ✅ Sent
                    </div>
                `;
            } else if (preview.sendStatus === 'failed') {
                statusDiv.innerHTML = `
                    <div class="status-indicator failed" style="
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        background: #f8d7da;
                        color: #721c24;
                        border: 1px solid #f5c6cb;
                        border-radius: 20px;
                        padding: 4px 8px;
                        font-size: 12px;
                        font-weight: bold;
                        z-index: 100;
                    ">
                        ❌ Failed
                    </div>
                `;
            }

            // Add to the preview content area
            const previewContent = document.getElementById('previewContent');
            if (previewContent) {
                previewContent.appendChild(statusDiv);
            }
        }
    }

    getAttachmentsForEmail(recipient, emailIndex = null) {
        const attachments = [];
        console.log('=== GETTING ATTACHMENTS FOR EMAIL ===');
        console.log('Recipient:', recipient);
        console.log('Email Index:', emailIndex);
        console.log('Available global attachments:', Array.from(this.attachments.keys()));
        console.log('Current preview attachments:', Array.from(this.currentPreviewAttachments.keys()));

        // Get consistent attachments (selected in dropdown)
        const selectedAttachments = document.getElementById('emailAttachments');
        console.log('Selected attachments dropdown:', selectedAttachments ? selectedAttachments.options.length : 'null');

        if (selectedAttachments) {
            for (let i = 0; i < selectedAttachments.options.length; i++) {
                const option = selectedAttachments.options[i];
                console.log(`Option ${i}:`, { value: option.value, selected: option.selected, text: option.text });
                if (option.selected && option.value) {
                    const fileData = this.attachments.get(option.value);
                    console.log('Found file data for', option.value, ':', !!fileData);
                    if (fileData) {
                        attachments.push({
                            filename: option.value,
                            size: fileData.size,
                            type: fileData.type,
                            data: fileData.data // Include the base64 data
                        });
                        console.log('Added consistent attachment:', option.value);
                    } else {
                        console.error('File data missing for selected attachment:', option.value);
                    }
                }
            }
        }

        // Get variable attachments from CSV
        if (this.variableAttachments) {
            console.log('Getting variable attachments for template:', this.variableAttachments);
            const varAttachments = this.getVariableAttachmentsForEmail(recipient);
            console.log('Variable attachments found:', varAttachments.length);
            attachments.push(...varAttachments);
        } else {
            console.log('No variable attachments template set');
        }

        // If we have preview data and a specific email index, include preview-specific attachments
        if (emailIndex !== null && this.emailPreviews[emailIndex]) {
            const previewAttachments = this.emailPreviews[emailIndex].attachments || [];
            console.log('Preview-specific attachments for email', emailIndex, ':', previewAttachments.length);
            console.log('Preview attachments data:', previewAttachments.map(att => ({ filename: att.filename, hasData: !!att.data })));
            previewAttachments.forEach(att => {
                // Only include if not already in the attachments list
                const alreadyExists = attachments.some(existing => existing.filename === att.filename);
                console.log(`Checking preview attachment ${att.filename}: already exists = ${alreadyExists}, has data = ${!!att.data}, data type = ${typeof att.data}`);
                if (!alreadyExists && att.data) {
                    attachments.push({
                        filename: att.filename,
                        size: att.size,
                        type: att.type,
                        data: att.data
                    });
                    console.log('Added preview-specific attachment:', att.filename);
                } else if (!att.data) {
                    console.error('Preview attachment missing data:', att);
                }
            });
        } else {
            console.log('No preview data or email index provided');
        }

        console.log('Final attachments for email:', attachments.length, attachments.map(a => a.filename));
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
            // Check if we have preview data (user has used preview mode)
            if (this.emailPreviews.length > 0) {
                // Use preview data for sending
                this.sendFromPreviewData();
            } else {
                // Use traditional form data
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

                this.sendEmailsTraditional();
            }

        } catch (error) {
            this.setLoading(false);
            this.showStatus(`Error sending emails: ${error.message}`, 'error');
        }
    }

    async sendFromPreviewData() {
        try {
            this.setLoading(true);

            // Get SMTP settings
            this.getSmtpSettings();

            // Validate we have recipients
            if (this.recipients.length === 0) {
                this.showStatus('No valid recipients to send to', 'error');
                return;
            }

            // Check if any preview emails have empty From addresses
            const emailsWithoutFrom = this.emailPreviews.filter(preview => !preview.from);
            if (emailsWithoutFrom.length > 0) {
                this.showStatus(`Some emails are missing From address. Please check preview and ensure all emails have valid sender addresses.`, 'error');
                return;
            }

            // Create individual email data for each recipient with their specific attachments
            const emailsData = this.emailPreviews.map((preview, index) => {
                // Get attachments specifically for this email
                const emailAttachments = this.getAttachmentsForEmail(preview.recipient, index);

                console.log(`DEBUG: Email ${index + 1} - Recipient: ${preview.recipient._rowNumber}, Preview attachments: ${preview.attachments.length}, Final attachments: ${emailAttachments.length}`);
                console.log(`DEBUG: Email ${index + 1} - Available global attachments: [${Array.from(this.attachments.keys())}]`);

                return {
                    to: preview.to,
                    from: preview.from,
                    cc: preview.cc,
                    bcc: preview.bcc,
                    subject: preview.subject,
                    body: preview.body,
                    attachments: emailAttachments
                };
            });

            // Use the first email's data as template for server compatibility
            const firstEmail = this.emailPreviews[0];
            const template = firstEmail.body || this.emailBody || '';
            const subject = firstEmail.subject || this.emailSubject || '';
            const fromEmail = firstEmail.from || this.fromEmail || '';

            // Debug logging
            console.log('DEBUG: Sending emails from preview data:', {
                recipientsCount: this.recipients.length,
                previewCount: this.emailPreviews.length,
                templateLength: template.length,
                fromEmail: fromEmail,
                subject: subject,
                hasAttachments: this.attachments.size > 0,
                attachments: Array.from(this.attachments.keys()),
                smtpServer: this.smtpServer,
                smtpPort: this.smtpPort,
                smtpUser: this.smtpUser
            });

            // Prepare attachments data - ensure all attachments are properly formatted
            const attachmentsData = {};
            for (const [filename, fileData] of this.attachments) {
                attachmentsData[filename] = {
                    filename: fileData.name, // ✅ Backend expects 'filename' property
                    type: fileData.type,
                    size: fileData.size,
                    data: fileData.data, // Base64 data URL
                    uploadedAt: fileData.uploadedAt
                };
            }

            const response = await fetch('/send-emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    emails: emailsData, // Send individual email data with specific attachments
                    csvData: this.csvData,
                    attachments: attachmentsData,
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
                // Store results in each preview object for status display
                this.storeSendResults(result.results);
                this.refreshPreviewDisplay();
                this.showStatus(result.summary, 'success');

                // Hide results section since we show status in preview
                document.getElementById('resultsSection').style.display = 'none';
            } else {
                this.showStatus(result.error, 'error');
            }

        } catch (error) {
            this.setLoading(false);
            this.showStatus(`Error sending emails: ${error.message}`, 'error');
        }
    }

    createModifiedCSVForSending() {
        // For now, return the original CSV data
        // The server expects the traditional format where it processes the CSV itself
        return this.csvData;
    }

    async sendEmailsTraditional() {
        try {
            this.setLoading(true);

            // Get SMTP settings before sending
            this.getSmtpSettings();

            // Debug logging for email sending
            console.log('Sending emails with traditional data:', {
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

        if (loading) {
            sendBtn.innerHTML = '<span class="spinner"></span>Sending...';
            sendBtn.disabled = true;
            document.body.classList.add('loading');
        } else {
            sendBtn.innerHTML = '🚀 Send Emails';
            sendBtn.disabled = false;
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
        // Handle case where filename might be undefined
        if (!filename) {
            console.error('getFileIcon called with undefined filename');
            return '📎';
        }

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

    // Table Editor Methods
    initializeTableEditor() {
        this.setupTableEventListeners();
        this.updateTableFromCSV();
    }

    setupTableEventListeners() {
        const table = document.getElementById('dataTable');
        if (!table) return;

        // Cell editing
        table.addEventListener('click', (e) => {
            if (e.target.classList.contains('data-cell') || e.target.classList.contains('header-cell')) {
                this.editCell(e.target);
            }
        });

        // Keyboard navigation
        table.addEventListener('keydown', (e) => {
            this.handleTableKeydown(e);
        });

        // Cell editing finish
        table.addEventListener('blur', (e) => {
            if (e.target.classList.contains('data-cell') || e.target.classList.contains('header-cell')) {
                this.finishCellEditing(e.target);
            }
        }, true);
    }

    editCell(cell) {
        // Remove editing state from other cells
        const table = document.getElementById('dataTable');
        const editingCells = table.querySelectorAll('.data-cell.editing, .header-cell.editing');
        editingCells.forEach(c => {
            c.classList.remove('editing');
            this.finishCellEditing(c);
        });

        // Add editing state to current cell
        cell.classList.add('editing');
        cell.focus();

        // Select all text if it's a header cell
        if (cell.classList.contains('header-cell')) {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(cell);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    finishCellEditing(cell) {
        cell.classList.remove('editing');
        this.updateCSVFromTable();
        this.saveData();
    }

    handleTableKeydown(e) {
        if (!e.target.classList.contains('data-cell') && !e.target.classList.contains('header-cell')) {
            return;
        }

        const cell = e.target;
        const table = document.getElementById('dataTable');
        let row = cell.closest('tr');
        let cellIndex = Array.from(row.cells).indexOf(cell);

        switch (e.key) {
            case 'Tab':
                e.preventDefault();
                this.moveToNextCell(cell, e.shiftKey ? -1 : 1);
                break;
            case 'Enter':
                e.preventDefault();
                if (cell.classList.contains('header-cell')) {
                    this.moveToNextRow(cell);
                } else {
                    this.moveToNextCell(cell, 1);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.moveToAdjacentCell(cell, -1, 'row');
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.moveToAdjacentCell(cell, 1, 'row');
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.moveToAdjacentCell(cell, -1, 'cell');
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.moveToAdjacentCell(cell, 1, 'cell');
                break;
            case 'Escape':
                cell.classList.remove('editing');
                cell.blur();
                break;
        }
    }

    moveToNextCell(currentCell, direction) {
        const table = document.getElementById('dataTable');
        const cells = Array.from(table.querySelectorAll('.data-cell, .header-cell'));
        const currentIndex = cells.indexOf(currentCell);
        const nextIndex = currentIndex + direction;

        if (nextIndex >= 0 && nextIndex < cells.length) {
            this.editCell(cells[nextIndex]);
        }
    }

    moveToAdjacentCell(currentCell, direction, type) {
        const row = currentCell.closest('tr');
        const cells = Array.from(row.cells);
        const cellIndex = cells.indexOf(currentCell);

        if (type === 'row') {
            const tbody = row.closest('tbody');
            const rows = Array.from(tbody.rows);
            const rowIndex = rows.indexOf(row);
            const newRowIndex = rowIndex + direction;

            if (newRowIndex >= 0 && newRowIndex < rows.length) {
                const newCell = rows[newRowIndex].cells[cellIndex];
                if (newCell) {
                    this.editCell(newCell);
                }
            }
        } else {
            const newCellIndex = cellIndex + direction;
            if (newCellIndex >= 0 && newCellIndex < cells.length) {
                this.editCell(cells[newCellIndex]);
            }
        }
    }

    moveToNextRow(currentCell) {
        const tbody = currentCell.closest('tbody');
        const rows = Array.from(tbody.rows);
        const rowIndex = rows.indexOf(currentCell.closest('tr'));
        const nextRowIndex = rowIndex + 1;

        if (nextRowIndex < rows.length) {
            const nextCell = rows[nextRowIndex].cells[0];
            if (nextCell) {
                this.editCell(nextCell);
            }
        }
    }

    addRow() {
        const table = document.getElementById('dataTable');
        const tbody = table.querySelector('tbody');
        const headerRow = table.querySelector('thead tr');
        const headerCount = headerRow.cells.length;

        // Create new row
        const newRow = document.createElement('tr');

        for (let i = 0; i < headerCount; i++) {
            const newCell = document.createElement('td');
            newCell.className = 'data-cell';
            newCell.contentEditable = 'true';
            newCell.dataset.row = tbody.rows.length;
            newCell.dataset.column = i;
            newCell.innerHTML = '<div class="cell-content"><span class="cell-text"></span><button class="delete-row-btn" onclick="deleteRowByIndex(' + tbody.rows.length + ')" title="Delete Row">×</button></div>';
            newRow.appendChild(newCell);
        }

        tbody.appendChild(newRow);
        this.updateCSVFromTable();
        this.saveData();
        this.showStatus('Row added', 'success');
    }

    removeRow() {
        const table = document.getElementById('dataTable');
        const tbody = table.querySelector('tbody');

        if (tbody.rows.length <= 1) {
            this.showStatus('Cannot remove the last data row', 'error');
            return;
        }

        tbody.deleteRow(-1);
        this.updateCSVFromTable();
        this.saveData();
        this.showStatus('Row removed', 'success');
    }

    addColumn() {
        const table = document.getElementById('dataTable');
        const headerRow = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');
        const columnIndex = headerRow.cells.length;

        // Add header cell
        const headerCell = document.createElement('th');
        headerCell.className = 'header-cell';
        headerCell.contentEditable = 'true';
        headerCell.dataset.column = columnIndex;
        headerCell.innerHTML = `<div class="header-content"><span class="header-text">Column ${columnIndex + 1}</span><button class="delete-column-btn" onclick="deleteColumnByIndex(${columnIndex})" title="Delete Column">×</button></div>`;
        headerRow.appendChild(headerCell);

        // Add data cells to each row
        Array.from(tbody.rows).forEach((row, rowIndex) => {
            const dataCell = document.createElement('td');
            dataCell.className = 'data-cell';
            dataCell.contentEditable = 'true';
            dataCell.dataset.row = rowIndex;
            dataCell.dataset.column = columnIndex;
            dataCell.textContent = '';
            row.appendChild(dataCell);
        });

        this.updateCSVFromTable();
        this.saveData();
        this.showStatus('Column added', 'success');
    }

    removeColumn() {
        const table = document.getElementById('dataTable');
        const headerRow = table.querySelector('thead tr');

        if (headerRow.cells.length <= 1) {
            this.showStatus('Cannot remove the last column', 'error');
            return;
        }

        // Remove last column from header
        headerRow.deleteCell(-1);

        // Remove last column from all data rows
        const tbody = table.querySelector('tbody');
        Array.from(tbody.rows).forEach(row => {
            row.deleteCell(-1);
        });

        this.updateCSVFromTable();
        this.saveData();
        this.showStatus('Column removed', 'success');
    }

    async pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            this.parsePastedData(text);
        } catch (error) {
            this.showStatus('Failed to read clipboard. Please use Ctrl+V to paste.', 'error');
        }
    }

    parsePastedData(text) {
        // Try to detect delimiter (tab, comma, semicolon)
        let delimiter = '\t'; // Default to tab
        let rows = text.trim().split('\n');

        if (rows.length > 0) {
            const firstRow = rows[0];

            // Detect delimiter by counting occurrences
            const tabCount = (firstRow.match(/\t/g) || []).length;
            const commaCount = (firstRow.match(/,/g) || []).length;
            const semicolonCount = (firstRow.match(/;/g) || []).length;

            if (commaCount > tabCount && commaCount > semicolonCount) {
                delimiter = ',';
            } else if (semicolonCount > tabCount && semicolonCount > commaCount) {
                delimiter = ';';
            }
        }

        // Parse rows
        const dataRows = rows.map(row => row.split(delimiter).map(cell => cell.trim()));

        if (dataRows.length === 0) {
            this.showStatus('No data to paste', 'error');
            return;
        }

        this.populateTableFromArray(dataRows);
        this.updateCSVFromTable();
        this.saveData();
        this.showStatus(`Pasted ${dataRows.length} rows and ${dataRows[0].length} columns`, 'success');
    }

    populateTableFromArray(dataArray) {
        const table = document.getElementById('dataTable');
        const tbody = table.querySelector('tbody');
        const headerRow = table.querySelector('thead tr');

        // Clear existing data
        tbody.innerHTML = '';
        headerRow.innerHTML = '';

        if (dataArray.length === 0) return;

        // First row becomes headers
        const headers = dataArray[0];
        headers.forEach((header, index) => {
            const headerCell = document.createElement('th');
            headerCell.className = 'header-cell';
            headerCell.contentEditable = 'true';
            headerCell.dataset.column = index;
            headerCell.innerHTML = `<div class="header-content"><span class="header-text">${header || `Column ${index + 1}`}</span><button class="delete-column-btn" onclick="deleteColumnByIndex(${index})" title="Delete Column">×</button></div>`;
            headerRow.appendChild(headerCell);
        });

        // Remaining rows become data
        for (let i = 1; i < dataArray.length; i++) {
            const row = document.createElement('tr');
            const rowData = dataArray[i];

            for (let j = 0; j < headers.length; j++) {
                const cell = document.createElement('td');
                cell.className = 'data-cell';
                cell.contentEditable = 'true';
                cell.dataset.row = i - 1;
                cell.dataset.column = j;
                cell.innerHTML = `<div class="cell-content"><span class="cell-text">${rowData[j] || ''}</span><button class="delete-row-btn" onclick="deleteRowByIndex(${i - 1})" title="Delete Row">×</button></div>`;
                row.appendChild(cell);
            }

            tbody.appendChild(row);
        }
    }

    updateTableFromCSV() {
        if (!this.csvData || this.csvData.trim() === '') {
            return;
        }

        try {
            const rows = this.csvData.trim().split('\n').filter(row => row.trim());
            if (rows.length === 0) return;

            const dataRows = rows.map(row => row.split(',').map(cell => cell.trim()));
            this.populateTableFromArray(dataRows);
        } catch (error) {
            console.error('Error updating table from CSV:', error);
        }
    }

    updateCSVFromTable() {
        const table = document.getElementById('dataTable');
        if (!table) return;

        const headerRow = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');

        // Extract only the header text, not the button text
        const headers = Array.from(headerRow.cells).map(cell => {
            const headerTextSpan = cell.querySelector('.header-text');
            return headerTextSpan ? headerTextSpan.textContent.trim() : cell.textContent.trim();
        });

        const rows = [];

        // Add headers as first row
        rows.push(headers.join(','));

        // Add data rows
        Array.from(tbody.rows).forEach(row => {
            const rowData = Array.from(row.cells).map(cell => {
                const cellTextSpan = cell.querySelector('.cell-text');
                return cellTextSpan ? cellTextSpan.textContent.trim() : cell.textContent.trim();
            });
            rows.push(rowData.join(','));
        });

        this.csvData = rows.join('\n');
        document.getElementById('csvData').value = this.csvData;
    }

    exportToCSV() {
        this.updateCSVFromTable();

        const blob = new Blob([this.csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data-source.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.showStatus('CSV file exported', 'success');
    }

    clearTable() {
        const table = document.getElementById('dataTable');
        const tbody = table.querySelector('tbody');
        const headerRow = table.querySelector('thead tr');

        // Keep one header and one data row
        headerRow.innerHTML = '<th contenteditable="true" data-column="0" class="header-cell"><div class="header-content"><span class="header-text">Column 1</span><button class="delete-column-btn" onclick="deleteColumnByIndex(0)" title="Delete Column">×</button></div></th>';
        tbody.innerHTML = '<tr><td contenteditable="true" data-row="0" data-column="0" class="data-cell"><div class="cell-content"><span class="cell-text"></span><button class="delete-row-btn" onclick="deleteRowByIndex(0)" title="Delete Row">×</button></div></td></tr>';

        this.csvData = '';
        document.getElementById('csvData').value = '';
        this.saveData();
        this.showStatus('Table cleared', 'success');
    }

    deleteColumnByIndex(columnIndex) {
        const table = document.getElementById('dataTable');
        const headerRow = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');

        // Check if this is the last column
        if (headerRow.cells.length <= 1) {
            this.showStatus('Cannot delete the last column', 'error');
            return;
        }

        // Remove header cell
        headerRow.deleteCell(columnIndex);

        // Remove corresponding cells from all data rows
        Array.from(tbody.rows).forEach(row => {
            if (row.cells[columnIndex]) {
                row.deleteCell(columnIndex);
            }
        });

        // Update data-column attributes for remaining cells
        this.updateCellAttributes();

        this.updateCSVFromTable();
        this.saveData();
        this.showStatus('Column deleted', 'success');
    }

    deleteRowByIndex(rowIndex) {
        const table = document.getElementById('dataTable');
        const tbody = table.querySelector('tbody');

        // Check if this is the last row
        if (tbody.rows.length <= 1) {
            this.showStatus('Cannot delete the last row', 'error');
            return;
        }

        // Remove the row
        tbody.deleteRow(rowIndex);

        // Update data-row attributes for remaining rows
        this.updateRowAttributes();

        this.updateCSVFromTable();
        this.saveData();
        this.showStatus('Row deleted', 'success');
    }

    updateCellAttributes() {
        const table = document.getElementById('dataTable');
        const headerRow = table.querySelector('thead tr');

        // Update header cell column attributes
        Array.from(headerRow.cells).forEach((cell, index) => {
            cell.dataset.column = index;
        });

        // Update data cell column attributes
        const tbody = table.querySelector('tbody');
        Array.from(tbody.rows).forEach((row, rowIndex) => {
            Array.from(row.cells).forEach((cell, cellIndex) => {
                cell.dataset.row = rowIndex;
                cell.dataset.column = cellIndex;
            });
        });
    }

    updateRowAttributes() {
        const table = document.getElementById('dataTable');
        const tbody = table.querySelector('tbody');

        // Update row attributes
        Array.from(tbody.rows).forEach((row, index) => {
            Array.from(row.cells).forEach(cell => {
                cell.dataset.row = index;
            });
        });
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

        // Auto-generate previews when preview tab is shown
        if (tabName === 'preview' && window.envialiteApp) {
            // Only generate if we don't have previews yet or if CSV data has changed
            if (window.envialiteApp.emailPreviews.length === 0) {
                try {
                    window.envialiteApp.getFormData();
                    window.envialiteApp.parseCSV();

                    if (window.envialiteApp.recipients.length > 0) {
                        window.envialiteApp.generateEmailPreviews();
                        window.envialiteApp.currentEmailIndex = 0;
                        window.envialiteApp.showCurrentEmailPreview();
                        window.envialiteApp.showStatus(`Preview generated for ${window.envialiteApp.recipients.length} emails`, 'success');
                    }
                } catch (error) {
                    console.error('Auto-preview generation failed:', error);
                }
            }
        }
    }

    // Add active class to clicked button
    if (event && event.target) {
        event.target.classList.add('active');
    }
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

function addAttachmentFromPicker() {
    window.envialiteApp.addAttachmentFromPicker();
}

// Table Editor Global Functions
function addRow() {
    window.envialiteApp.addRow();
}

function removeRow() {
    window.envialiteApp.removeRow();
}

function addColumn() {
    window.envialiteApp.addColumn();
}

function removeColumn() {
    window.envialiteApp.removeColumn();
}

function pasteFromClipboard() {
    window.envialiteApp.pasteFromClipboard();
}

function exportToCSV() {
    window.envialiteApp.exportToCSV();
}

function clearTable() {
    window.envialiteApp.clearTable();
}

function deleteColumnByIndex(columnIndex) {
    window.envialiteApp.deleteColumnByIndex(columnIndex);
}

function deleteRowByIndex(rowIndex) {
    window.envialiteApp.deleteRowByIndex(rowIndex);
}

// Preview Editor Global Functions
function savePreviewChanges() {
    window.envialiteApp.savePreviewChanges();
}

function resetPreviewToOriginal() {
    window.envialiteApp.resetPreviewToOriginal();
}

function uploadPreviewFiles() {
    window.envialiteApp.uploadPreviewFiles();
}

function removePreviewAttachment(filename) {
    window.envialiteApp.removePreviewAttachment(filename);
}

function refreshPreviewVariables() {
    window.envialiteApp.refreshPreviewVariables();
}
