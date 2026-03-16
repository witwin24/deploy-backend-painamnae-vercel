const nodemailer = require('nodemailer');
const fs = require('fs');

/**
 * Send exported user data zip file via email
 * @param {string} recipientEmail - Recipient email address
 * @param {Buffer} zipBuffer - Zip file data as buffer
 * @param {string} userName - User name for personalization
 * @returns {Object} - { success: boolean, message: string }
 */
const sendExportedDataEmail = async (recipientEmail, zipBuffer, userName) => {
    try {
        // ตรวจสอบว่ามี .env ที่กำหนด email config
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            console.warn('[Email Service] Email credentials not configured in .env');
            return {
                success: false,
                message: 'Email service not configured. Please contact administrator.'
            };
        }

        // สร้าง transporter สำหรับส่ง email
        const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        // Check if zip buffer exists
        if (!zipBuffer || zipBuffer.length === 0) {
            throw new Error('Zip file data is empty');
        }

        // เตรียม email content
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: recipientEmail,
            subject: 'Your Account Data Export - PaiNamNae',
            html: `
                <h2>Account Data Export</h2>
                <p>Dear ${userName},</p>
                <p>As requested, your account data has been exported and compressed into a zip file.</p>
                
                <h3>File Details:</h3>
                <ul>
                    <li><strong>File Name:</strong> user_data_export.zip</li>
                    <li><strong>Contents:</strong> Personal data and account records as selected during your account deletion process.</li>
                </ul>
                
                <h3>How to Extract:</h3>
                <ol>
                    <li>Download the attached zip file</li>
                    <li>Extract the files on your computer using any zip extraction tool</li>
                </ol>
                
                <p><strong>Note:</strong> This is an automated email. Your account has been deleted, and this export file is for your records.</p>
                
                <p>Best regards,<br>PaiNamNae Support Team</p>
            `,
            attachments: [
                {
                    filename: 'user_data_export.zip',
                    content: zipBuffer
                }
            ]
        };

        // ส่ง email
        const info = await transporter.sendMail(mailOptions);
        
        console.log('[Email] Sent to:', recipientEmail, 'Message ID:', info.messageId);

        return {
            success: true,
            message: 'Export data sent to email successfully',
            messageId: info.messageId
        };

    } catch (error) {
        console.error('[Email Service Error]', error);
        return {
            success: false,
            message: error.message || 'Failed to send email'
        };
    }
};

module.exports = {
    sendExportedDataEmail
};
