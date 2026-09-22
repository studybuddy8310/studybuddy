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
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { sendPasswordResetOtpEmail, sendPasswordResetConfirmationEmail } = require("./utils/email");

admin.initializeApp();
const db = admin.firestore();

// The EmailJS Private Key is a real secret — it is NEVER stored in this
// repo (not in .env, not anywhere). It lives only in Google Cloud Secret
// Manager. Set it once with:
//   firebase functions:secrets:set EMAILJS_PRIVATE_KEY
// Each function below that sends email declares { secrets: [emailjsPrivateKey] },
// which makes Firebase inject it as process.env.EMAILJS_PRIVATE_KEY for
// that function's execution only — utils/email.js reads it the same way
// it always did, no code change needed there.
const emailjsPrivateKey = defineSecret("EMAILJS_PRIVATE_KEY");

const OTP_TTL_MS      = 10 * 60 * 1000;  // 10 minutes
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;    // don't allow spamming "send OTP"
const MAX_OTP_ATTEMPTS = 5;

function norm(s) {
  return (s || "").toString().trim().toLowerCase();
}

function genOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function genToken() {
  return require("crypto").randomBytes(24).toString("hex");
}

// ── 1. Verify identity, then generate + email an OTP ─────────
exports.requestPasswordResetOtp = onCall({ cors: true, secrets: [emailjsPrivateKey] }, async (request) => {
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

  await sendPasswordResetOtpEmail(u.email || email, u.firstName, otp);

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
exports.completePasswordReset = onCall({ cors: true, secrets: [emailjsPrivateKey] }, async (request) => {
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

  // Best-effort confirmation email — don't fail the reset if this errors
  try {
    await sendPasswordResetConfirmationEmail(userRecord.email, userRecord.displayName || "Student");
  } catch (e) {
    logger.warn("Password reset confirmation email failed to send", e);
  }

  return { ok: true };
});
