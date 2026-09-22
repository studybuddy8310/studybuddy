// ============================================================
// StudyBuddy Cloud Functions — Forgot Password flow
//
// Why this exists: the Firebase client SDK will never let a
// signed-out visitor set an arbitrary account's password just
// because they typed a matching OTP — only the Admin SDK can do
// that, and the Admin SDK only runs on a server. These three
// callable functions are that small server.
//
// Deploy: from the "functions" folder run
//   npm install
//   firebase deploy --only functions
// (requires the Blaze "pay as you go" plan — this usage stays
// inside the free monthly quota).
// ============================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// EmailJS credentials for SERVER-SIDE sending.
// Create functions/.env with these two lines (see functions/.env.example):
//   EMAILJS_SERVICE_ID=service_4xpjztg
//   EMAILJS_TEMPLATE_ID=template_9hxgir7
//   EMAILJS_PUBLIC_KEY=Wvfl_ifH3R6tzLn26
//   EMAILJS_PRIVATE_KEY=<your EmailJS Private Key, from EmailJS Dashboard → Account → API Keys>
// You must also enable "Allow non-browser (server) requests" for
// this in your EmailJS account, or the send will be rejected.
const EMAILJS_SERVICE_ID  = process.env.EMAILJS_SERVICE_ID  || "service_4xpjztg";
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || "template_9hxgir7";
const EMAILJS_PUBLIC_KEY  = process.env.EMAILJS_PUBLIC_KEY  || "Wvfl_ifH3R6tzLn26";
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || "";

const OTP_TTL_MS      = 10 * 60 * 1000;  // 10 minutes
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;    // don't allow spamming "send OTP"
const MAX_OTP_ATTEMPTS = 5;

function norm(s) {
  return (s || "").toString().trim().toLowerCase();
}

async function sendEmail(toEmail, studentName, subject, message) {
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
        student_name: studentName || "Student",
        subject,
        message,
      },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    logger.error("EmailJS send failed", resp.status, text);
    throw new HttpsError("internal", "Failed to send email. Please try again shortly.");
  }
}

function genOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function genToken() {
  return require("crypto").randomBytes(24).toString("hex");
}

// ── 1. Verify identity, then generate + email an OTP ─────────
exports.requestPasswordResetOtp = onCall({ cors: true }, async (request) => {
  const { firstName, lastName, dateOfBirth, phone, email } = request.data || {};

  if (!firstName || !lastName || !dateOfBirth || !phone || !email) {
    throw new HttpsError("invalid-argument", "All fields are required.");
  }

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(norm(email));
  } catch (e) {
    // Generic message — never reveal whether the email exists.
    throw new HttpsError("not-found", "We couldn't verify those details. Please check and try again.");
  }

  const uid = userRecord.uid;
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "We couldn't verify those details. Please check and try again.");
  }
  const u = snap.data();

  const matches =
    norm(u.firstName) === norm(firstName) &&
    norm(u.lastName)  === norm(lastName)  &&
    norm(u.phone)     === norm(phone)     &&
    (u.dateOfBirth || "") === (dateOfBirth || "");

  if (!matches) {
    throw new HttpsError("not-found", "We couldn't verify those details. Please check and try again.");
  }

  // Cooldown to prevent spamming
  const otpRef = db.collection("passwordResetOtps").doc(uid);
  const existing = await otpRef.get();
  if (existing.exists) {
    const createdAtMs = existing.data().createdAt?.toMillis?.() || 0;
    if (Date.now() - createdAtMs < RESEND_COOLDOWN_MS) {
      throw new HttpsError("resource-exhausted", "Please wait a bit before requesting another OTP.");
    }
  }

  const otp = genOtp();
  await otpRef.set({
    email: norm(email),
    otp,
    attempts: 0,
    verified: false,
    resetToken: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAtMs: Date.now() + OTP_TTL_MS,
  });

  await sendEmail(
    u.email || email,
    u.firstName,
    "StudyBuddy — Password Reset OTP",
    `Your OTP to reset your StudyBuddy password is:\n\n${otp}\n\nThis OTP is valid for 10 minutes. If you didn't request this, you can ignore this email.`
  );

  return { ok: true };
});

// ── 2. Verify the OTP, issue a short-lived reset token ────────
exports.verifyPasswordResetOtp = onCall({ cors: true }, async (request) => {
  const { email, otp } = request.data || {};
  if (!email || !otp) {
    throw new HttpsError("invalid-argument", "Email and OTP are required.");
  }

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(norm(email));
  } catch (e) {
    throw new HttpsError("not-found", "Invalid or expired OTP.");
  }
  const uid = userRecord.uid;

  const otpRef = db.collection("passwordResetOtps").doc(uid);
  const otpSnap = await otpRef.get();
  if (!otpSnap.exists) {
    throw new HttpsError("not-found", "Invalid or expired OTP. Please request a new one.");
  }
  const data = otpSnap.data();

  if (Date.now() > (data.expiresAtMs || 0)) {
    await otpRef.delete();
    throw new HttpsError("deadline-exceeded", "This OTP has expired. Please request a new one.");
  }
  if ((data.attempts || 0) >= MAX_OTP_ATTEMPTS) {
    await otpRef.delete();
    throw new HttpsError("resource-exhausted", "Too many incorrect attempts. Please request a new OTP.");
  }
  if (data.otp !== otp.toString().trim()) {
    await otpRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
    throw new HttpsError("permission-denied", "Incorrect OTP. Please try again.");
  }

  const resetToken = genToken();
  await otpRef.update({
    verified: true,
    resetToken,
    resetTokenExpiresAtMs: Date.now() + RESET_TOKEN_TTL_MS,
  });

  return { ok: true, resetToken };
});

// ── 3. Spend the reset token to actually set the new password ─
exports.completePasswordReset = onCall({ cors: true }, async (request) => {
  const { email, resetToken, newPassword } = request.data || {};
  if (!email || !resetToken || !newPassword) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }
  if (newPassword.length < 8) {
    throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
  }

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(norm(email));
  } catch (e) {
    throw new HttpsError("not-found", "Invalid or expired session. Please start over.");
  }
  const uid = userRecord.uid;

  const otpRef = db.collection("passwordResetOtps").doc(uid);
  const otpSnap = await otpRef.get();
  if (!otpSnap.exists) {
    throw new HttpsError("not-found", "Invalid or expired session. Please start over.");
  }
  const data = otpSnap.data();

  if (!data.verified || data.resetToken !== resetToken) {
    throw new HttpsError("permission-denied", "Invalid or expired session. Please start over.");
  }
  if (Date.now() > (data.resetTokenExpiresAtMs || 0)) {
    await otpRef.delete();
    throw new HttpsError("deadline-exceeded", "This session has expired. Please start over.");
  }

  await admin.auth().updateUser(uid, { password: newPassword });
  await otpRef.delete();

  return { ok: true };
});
