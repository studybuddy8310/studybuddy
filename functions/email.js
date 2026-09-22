// ============================================================
// functions/utils/email.js
// PURPOSE : Server-side twin of js/utils/email.js — same universal
//           EmailJS template, same "sendEmail(...)" shape, but
//           called from Node (a Cloud Function) instead of a
//           browser, so it uses EmailJS's REST API + your EmailJS
//           Private Key instead of the emailjs browser SDK.
//
// HOW TO USE in any function file:
//   const { sendEmail, sendPasswordResetOtpEmail } = require('./utils/email');
//   await sendEmail('student@email.com', 'Ravi', 'Subject', 'Message body');
//
// SETUP: create functions/.env (copy functions/.env.example) and
// fill in EMAILJS_PRIVATE_KEY — see that file for where to get it.
// ============================================================

const logger = require("firebase-functions/logger");

const EMAILJS_SERVICE_ID  = process.env.EMAILJS_SERVICE_ID  || "service_4xpjztg";
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || "template_9hxgir7";
const EMAILJS_PUBLIC_KEY  = process.env.EMAILJS_PUBLIC_KEY  || "Wvfl_ifH3R6tzLn26";
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || "";

/**
 * Sends an email via EmailJS's REST API, using the same universal
 * template as the front end (js/utils/email.js). This is the
 * server-side equivalent — used from Cloud Functions, where there's
 * no browser for the emailjs SDK to run in.
 *
 * @param {string} toEmail      - Recipient email address
 * @param {string} studentName  - Recipient's first name
 * @param {string} subject      - Email subject line
 * @param {string} message      - Email body text
 * @returns {Promise}
 */
async function sendEmail(toEmail, studentName, subject, message) {
  if (!EMAILJS_PRIVATE_KEY) {
    logger.error("EMAILJS_PRIVATE_KEY is not set — see functions/.env.example");
    throw new Error("Email sending is not configured yet.");
  }

  const resp = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id:  EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id:     EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: {
        to_email:     toEmail,
        student_name: studentName,
        subject:      subject,
        message:      message,
      },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    logger.error("EmailJS send failed", resp.status, text);
    throw new Error("Failed to send email. Please try again shortly.");
  }
}

// ── Pre-built email senders ───────────────────────────────────
// Call these directly instead of building the message each time.
// Mirrors the pre-built senders in js/utils/email.js.

/** Sends the password-reset OTP email */
async function sendPasswordResetOtpEmail(toEmail, firstName, otp) {
  return sendEmail(
    toEmail,
    firstName,
    'StudyBuddy — Password Reset OTP',
    `Your OTP to reset your StudyBuddy password is:\n\n${otp}\n\nThis OTP is valid for 10 minutes.\nIf you didn't request this, you can safely ignore this email.\n\n— Team StudyBuddy`
  );
}

/** Sends a confirmation email once a password has been reset */
async function sendPasswordResetConfirmationEmail(toEmail, firstName) {
  return sendEmail(
    toEmail,
    firstName,
    'StudyBuddy — Your Password Was Reset',
    `Your StudyBuddy password was just reset successfully.\n\nIf this wasn't you, please contact your admin immediately.\n\n— Team StudyBuddy`
  );
}

module.exports = {
  sendEmail,
  sendPasswordResetOtpEmail,
  sendPasswordResetConfirmationEmail,
};
