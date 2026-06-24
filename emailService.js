import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create mock-emails directory for development logging
const mockEmailsDir = path.join(__dirname, 'mock-emails');
if (!fs.existsSync(mockEmailsDir)) {
  fs.mkdirSync(mockEmailsDir, { recursive: true });
}

// Get the company logo file path
const getLogoAttachment = () => {
  const logoPath = path.resolve(__dirname, '..', 'frontend', 'public', 'footer_logo.png');
  if (fs.existsSync(logoPath)) {
    return {
      filename: 'footer_logo.png',
      path: logoPath,
      cid: 'company-logo', // CID references in HTML body as <img src="cid:company-logo" />
      contentType: 'image/png',
      contentDisposition: 'inline'
    };
  }
  return null;
};

// Check and verify SMTP transporter on startup
const verifySmtpSetup = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : '';

  const missing = [];
  if (!host) missing.push('SMTP_HOST');
  if (!user) missing.push('SMTP_USER');
  if (!pass) missing.push('SMTP_PASS');

  if (missing.length > 0) {
    console.warn(
      `\x1b[33m[SMTP WARNING] SMTP is not configured. Missing variables in backend/.env: ${missing.join(', ')}.\n` +
      `Real emails cannot be sent. Emails will be saved locally as mock files in: ${mockEmailsDir}\x1b[0m`
    );
  } else {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: { user, pass }
    });

    transporter.verify((error) => {
      if (error) {
        console.error(
          `\x1b[31m[SMTP ERROR] SMTP connection verification failed. Please check your credentials in backend/.env.\n` +
          `Error details: ${error.message}\x1b[0m`
        );
      } else {
        console.log(`\x1b[32m[SMTP SUCCESS] SMTP server is ready to send real emails via ${host}.\x1b[0m`);
      }
    });
  }
};

verifySmtpSetup();

// Create SMTP Transporter or fallback to local mock file logger
const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : '';

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port: parseInt(port || '587', 10),
      secure: port === '465',
      auth: { user, pass }
    });
  }
  return null;
};

const saveMockEmail = (to, subject, html) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `email-${to}-${timestamp}.html`;
  const filePath = path.join(mockEmailsDir, fileName);
  fs.writeFileSync(filePath, `<!-- Subject: ${subject} -->\n<!-- To: ${to} -->\n\n${html}`);
  console.log(`[MOCK EMAIL SENT] Saved email file to: ${filePath}`);
};

const sendEmail = async ({ to, subject, html, text, attachments }) => {
  const transporter = getTransporter();
  const from = `"Shivohara" <${process.env.FROM_EMAIL || 'partner@shivohara.com'}>`;

  if (transporter) {
    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
        attachments
      });
      console.log(`Email successfully sent to ${to}`);
    } catch (err) {
      console.error(`Failed to send real email via SMTP, falling back to mock file write. Error:`, err);
      saveMockEmail(to, subject, html);
    }
  } else {
    saveMockEmail(to, subject, html);
  }
};


// --- HTML Layout Builder (Premium, Minimal Light Aesthetics) ---
const buildHtmlTemplate = (title, contentBody) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #f6f8fa;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #24292f;
            -webkit-font-smoothing: antialiased;
          }
          .email-wrapper {
            width: 100%;
            padding: 3rem 0;
            background-color: #f6f8fa;
          }
          .email-container {
            max-width: 580px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            border: 1px solid #e1e4e8;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
            overflow: hidden;
          }
          .header {
            padding: 2.5rem 2rem 1.5rem 2rem;
            text-align: center;
          }
          .logo-img {
            max-height: 48px;
            max-width: 180px;
            width: auto;
            height: auto;
            object-fit: contain;
          }
          .body-content {
            padding: 0 2.5rem 2.5rem 2.5rem;
            line-height: 1.6;
            font-size: 15px;
          }
          .title-text {
            font-size: 20px;
            font-weight: 600;
            color: #000000;
            margin-bottom: 1.25rem;
            letter-spacing: -0.3px;
          }
          .details-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 1.25rem 1.5rem;
            margin: 1.75rem 0;
          }
          .details-title {
            font-weight: 600;
            color: #0f172a;
            margin-bottom: 0.75rem;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .details-row {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid #e2e8f0;
          }
          .details-row:last-child {
            border-bottom: none;
          }
          .details-key {
            color: #64748b;
            font-weight: 500;
            font-size: 14px;
          }
          .details-val {
            font-weight: 600;
            color: #0f172a;
            font-size: 14px;
          }
          .footer {
            padding: 1.75rem 2.5rem;
            background-color: #f8fafc;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 12px;
            color: #64748b;
          }
          .footer-brand {
            font-weight: 600;
            letter-spacing: 1.5px;
            color: #0f172a;
            margin-bottom: 0.25rem;
          }
          .footer-tag {
            color: #94a3b8;
            font-style: italic;
          }
          .btn-action {
            display: inline-block;
            background-color: #0f172a;
            color: #ffffff !important;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            font-size: 14px;
            margin-top: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header">
              <img src="cid:company-logo" alt="" width="180" style="display: inline-block; border: none; outline: none; width: 180px; max-width: 100%; height: auto;" />
            </div>
            <div class="body-content">
              ${contentBody}
            </div>
            <div class="footer">
              <div class="footer-brand">SHIVOHARA</div>
              <div class="footer-tag">Fusing pure consciousness with engineering scale</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

// --- Email Triggers ---

// 1. Application Received Email
export const sendApplicationReceivedEmail = async (to, name, jobTitle) => {
  const subject = `Application Received - SHIVOHARA`;
  const content = `
    <div class="title-text">Application Submitted Successfully</div>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Thank you for your interest in joining the team at <strong>SHIVOHARA</strong>! We have received your application for the position of <strong>${jobTitle}</strong> and are currently reviewing your credentials.</p>
    
    <div class="details-card">
      <div class="details-title">Applied Details</div>
      <div class="details-row">
        <span class="details-key">Position:</span>
        <span class="details-val">${jobTitle}</span>
      </div>
      <div class="details-row">
        <span class="details-key">Name:</span>
        <span class="details-val">${name}</span>
      </div>
      <div class="details-row">
        <span class="details-key">Status:</span>
        <span class="details-val" style="color: #cda812;">Pending Review</span>
      </div>
    </div>
    
    <p>We appreciate the time you took to share your qualifications with us. If your experience aligns with our requirements, a team member will reach out to schedule an interview.</p>
    <p>Best regards,</p>
    <p><strong>The SHIVOHARA Team</strong></p>
  `;

  const html = buildHtmlTemplate('Application Submitted', content);
  const text = `Hi ${name},\n\nThank you for your interest in joining SHIVOHARA!\n\nWe have received your application for the position of "${jobTitle}" and are currently reviewing your credentials.\n\nWe appreciate the time you took to share your qualifications with us. If your experience aligns with our requirements, a team coordinator will reach out to schedule an interview.\n\nBest regards,\nThe SHIVOHARA Team`;
  const logoAttachment = getLogoAttachment();
  const attachments = logoAttachment ? [logoAttachment] : [];

  await sendEmail({ to, subject, html, text, attachments });
};

// 2. Candidate Shortlisted Email
export const sendShortlistedEmail = async (to, name, jobTitle) => {
  const subject = `Application Update: Shortlisted - SHIVOHARA`;
  const content = `
    <div class="title-text">Congratulations! You've been Shortlisted</div>
    <p>Hi <strong>${name}</strong>,</p>
    <p>We have reviewed your application for the position of <strong>${jobTitle}</strong> at <strong>SHIVOHARA</strong>, and we are incredibly impressed with your background and qualifications.</p>
    <p>We would love to advance you to the interview round. Our engineering team is currently scheduling interview cycles, and a team coordinator will get in touch with you shortly to finalize a calendar invite.</p>
    
    <div class="details-card">
      <div class="details-title">Application Status</div>
      <div class="details-row">
        <span class="details-key">Position:</span>
        <span class="details-val">${jobTitle}</span>
      </div>
      <div class="details-row">
        <span class="details-key">Status:</span>
        <span class="details-val" style="color: #28a745;">Shortlisted</span>
      </div>
    </div>

    <p>Please make sure to have your portfolio or project repositories handy for discussion during the session. We look forward to talking with you soon!</p>
    <p>Warm regards,</p>
    <p><strong>The SHIVOHARA Team</strong></p>
  `;

  const html = buildHtmlTemplate('Shortlisted for Interview', content);
  const text = `Hi ${name},\n\nCongratulations! We have reviewed your application for the position of "${jobTitle}" at SHIVOHARA, and we are incredibly impressed with your background.\n\nWe would love to advance you to the interview round. Our team is scheduling interview cycles, and a coordinator will get in touch with you shortly.\n\nStatus: Shortlisted\n\nPlease have your portfolio or project repositories handy. We look forward to speaking with you soon!\n\nWarm regards,\nThe SHIVOHARA Team`;
  const logoAttachment = getLogoAttachment();
  const attachments = logoAttachment ? [logoAttachment] : [];

  await sendEmail({ to, subject, html, text, attachments });
};

// 3. Regret Email
export const sendRegretEmail = async (to, name, jobTitle) => {
  const subject = `Application Update: ${jobTitle} - SHIVOHARA`;
  const content = `
    <div class="title-text">Application Status Update</div>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Thank you for taking the time to apply for the position of <strong>${jobTitle}</strong> at <strong>SHIVOHARA</strong> and for sharing your resume with us.</p>
    <p>We received a very high volume of exceptional applications for this position. After a careful review of your qualifications alongside our current team focus, we regret to inform you that we will not be moving forward with your application at this time.</p>
    
    <div class="details-card">
      <div class="details-title">Application Status</div>
      <div class="details-row">
        <span class="details-key">Position:</span>
        <span class="details-val">${jobTitle}</span>
      </div>
      <div class="details-row">
        <span class="details-key">Status:</span>
        <span class="details-val" style="color: #dc3545;">Closed</span>
      </div>
    </div>

    <p>We will keep your resume on file for future opportunities that align with your unique skill set. We sincerely appreciate your interest in our company and wish you the absolute best in your professional endeavors.</p>
    <p>Best regards,</p>
    <p><strong>The SHIVOHARA Recruiting Team</strong></p>
  `;

  const html = buildHtmlTemplate('Application Update', content);
  const text = `Hi ${name},\n\nThank you for applying for the position of "${jobTitle}" at SHIVOHARA.\n\nWe received a very high volume of exceptional applications, and we regret to inform you that we will not be moving forward with your candidacy at this time.\n\nStatus: Closed\n\nWe will keep your resume on file for future openings. We appreciate your interest and wish you the best in your professional endeavors.\n\nBest regards,\nThe SHIVOHARA Recruiting Team`;
  const logoAttachment = getLogoAttachment();
  const attachments = logoAttachment ? [logoAttachment] : [];

  await sendEmail({ to, subject, html, text, attachments });
};

// 4. Admin Application Notification Email
export const sendAdminApplicationNotification = async (adminEmail, candidateName, candidateEmail, jobTitle, portfolioUrl, coverLetter) => {
  const subject = `New Application: ${candidateName} - ${jobTitle}`;
  const content = `
    <div class="title-text">New Application Submitted</div>
    <p>A new candidate has applied for the position of <strong>${jobTitle}</strong>.</p>
    
    <div class="details-card">
      <div class="details-title">Candidate Details</div>
      <div class="details-row">
        <span class="details-key">Name:</span>
        <span class="details-val">${candidateName}</span>
      </div>
      <div class="details-row">
        <span class="details-key">Email:</span>
        <span class="details-val">${candidateEmail}</span>
      </div>
      <div class="details-row">
        <span class="details-key">Portfolio / Links:</span>
        <span class="details-val"><a href="${portfolioUrl}" target="_blank" style="color: #00bcd4; text-decoration: underline;">${portfolioUrl || 'None'}</a></span>
      </div>
    </div>
    
    <p><strong>Cover Letter:</strong></p>
    <div style="white-space: pre-wrap; background-color: #f8f9fa; border: 1px solid rgba(0, 0, 0, 0.05); padding: 1.25rem; border-radius: 8px; font-size: 0.95rem; line-height: 1.5; color: #495057; margin-top: 0.5rem;">${coverLetter || 'No cover letter provided.'}</div>
    
    <p style="margin-top: 2rem;">You can review this application, download their resume, and update their candidate status on the admin dashboard.</p>
  `;

  const html = buildHtmlTemplate('New Application Received', content);
  const text = `New Application Submitted!\n\nA new candidate has applied for the position of "${jobTitle}".\n\nCandidate Profile:\n- Name: ${candidateName}\n- Email: ${candidateEmail}\n- Portfolio/Links: ${portfolioUrl || 'None'}\n\nCover Letter:\n${coverLetter || 'No cover letter provided.'}\n\nYou can review this application on your Admin Dashboard.`;
  const logoAttachment = getLogoAttachment();
  const attachments = logoAttachment ? [logoAttachment] : [];

  await sendEmail({ to: adminEmail, subject, html, text, attachments });
};

// 5. Admin Inquiry Notification Email
export const sendAdminInquiryNotification = async (adminEmail, inquirerName, inquirerEmail, serviceType, message) => {
  const subject = `New Website Inquiry: ${serviceType} - ${inquirerName}`;
  const content = `
    <div class="title-text">New Website Inquiry</div>
    <p>A visitor has submitted a contact inquiry on the website.</p>
    
    <div class="details-card">
      <div class="details-title">Inquiry Information</div>
      <div class="details-row">
        <span class="details-key">Name:</span>
        <span class="details-val">${inquirerName}</span>
      </div>
      <div class="details-row">
        <span class="details-key">Email:</span>
        <span class="details-val">${inquirerEmail}</span>
      </div>
      <div class="details-row">
        <span class="details-key">Service Type:</span>
        <span class="details-val">${serviceType}</span>
      </div>
    </div>
    
    <p><strong>Message / Requirements:</strong></p>
    <div style="white-space: pre-wrap; background-color: #f8f9fa; border: 1px solid rgba(0, 0, 0, 0.05); padding: 1.25rem; border-radius: 8px; font-size: 0.95rem; line-height: 1.5; color: #495057; margin-top: 0.5rem;">${message}</div>
    
    <p style="margin-top: 2rem;">Please reply to the inquirer directly at <a href="mailto:${inquirerEmail}" style="color: #00bcd4; text-decoration: underline;">${inquirerEmail}</a>.</p>
  `;

  const html = buildHtmlTemplate('New Website Inquiry', content);
  const text = `New Website Inquiry Received!\n\nA visitor has submitted an inquiry on the website.\n\nInquiry Details:\n- Name: ${inquirerName}\n- Email: ${inquirerEmail}\n- Requested Service: ${serviceType}\n\nMessage / Requirements:\n${message}\n\nPlease reply to the inquirer directly at ${inquirerEmail}.`;
  const logoAttachment = getLogoAttachment();
  const attachments = logoAttachment ? [logoAttachment] : [];

  await sendEmail({ to: adminEmail, subject, html, text, attachments });
};
