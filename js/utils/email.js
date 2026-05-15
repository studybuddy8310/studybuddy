// ============================================================
// js/utils/email.js
// PURPOSE : Single reusable function to send all emails via
//           EmailJS using our one universal template.
//
// HOW TO USE in any file:
//   import { sendEmail } from '../utils/email.js';
//   await sendEmail('student@email.com', 'Ravi', 'Subject', 'Message body');
// ============================================================

import { EMAILJS_CONFIG } from '../firebase-config.js';

/**
 * Sends an email via EmailJS universal template.
 *
 * @param {string} toEmail      - Recipient email address
 * @param {string} studentName  - Recipient's first name
 * @param {string} subject      - Email subject line
 * @param {string} message      - Email body text
 * @returns {Promise}
 */
export async function sendEmail(toEmail, studentName, subject, message) {
  // EmailJS must be loaded via <script> tag in HTML before calling this.
  // It attaches itself to window.emailjs automatically.
  if (typeof emailjs === 'undefined') {
    console.error('EmailJS not loaded. Add the EmailJS script tag to your HTML.');
    return;
  }

  return emailjs.send(
    EMAILJS_CONFIG.serviceId,
    EMAILJS_CONFIG.templateId,
    {
      to_email:     toEmail,
      student_name: studentName,
      subject:      subject,
      message:      message
    },
    EMAILJS_CONFIG.publicKey
  );
}

// ── Pre-built email senders ───────────────────────────────────
// Call these directly instead of building the message each time.

/** Sends OTP verification email */
export async function sendOTPEmail(toEmail, firstName, otp) {
  return sendEmail(
    toEmail,
    firstName,
    'StudyBuddy — Your OTP Code',
    `Your OTP for StudyBuddy registration is:\n\n${otp}\n\nThis OTP is valid for 10 minutes.\nDo not share it with anyone.\n\n— Team StudyBuddy`
  );
}

/** Sends account approved email */
export async function sendApprovedEmail(toEmail, firstName, course, level) {
  return sendEmail(
    toEmail,
    firstName,
    'StudyBuddy — Your Account is Approved! 🎉',
    `Great news! Your StudyBuddy account has been approved.\n\nYou can now login and start your ${course} ${level} journey!\n\nLogin here: https://studybuddy8310.github.io/studybuddy\n\nBest of luck with your studies!\n— Team StudyBuddy`
  );
}

/** Sends account rejected email */
export async function sendRejectedEmail(toEmail, firstName, reason = '') {
  return sendEmail(
    toEmail,
    firstName,
    'StudyBuddy — Account Registration Update',
    `We regret to inform you that your StudyBuddy account registration was not approved at this time.\n\n${reason ? 'Reason: ' + reason + '\n\n' : ''}If you believe this is an error, please contact your admin.\n\n— Team StudyBuddy`
  );
}

/** Sends exam reminder email to a student */
export async function sendReminderEmail(toEmail, firstName, subject, message) {
  return sendEmail(toEmail, firstName, subject, message + '\n\n— Team StudyBuddy');
}
