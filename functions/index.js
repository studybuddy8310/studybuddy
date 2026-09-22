// ============================================================
// StudyBuddy Cloud Functions — Forgot Password (no OTP)
//
// Why this file exists at all: the Firebase client SDK will never
// let a signed-out visitor set an arbitrary account's password —
// only the Admin SDK can do that, and the Admin SDK only runs on a
// server. This one function IS that server. Everything else
// (collecting First/Last Name, Date of Birth, Phone, Email across
// separate pages) happens in the browser with no server involved —
// this function is only called once, right at the very end, with
// everything the wizard collected plus the new password.
//
// Deploy: from the "functions" folder run
//   npm install
//   firebase deploy --only functions
// (requires the Blaze "pay as you go" plan — this usage stays
// inside the free monthly quota). No secrets, no .env, no EmailJS
// needed for this anymore since there's no OTP email to send.
// ============================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

function norm(s) {
  return (s || "").toString().trim().toLowerCase();
}

// Verifies First Name, Last Name, Date of Birth, Phone and Email all
// match the stored account, and — only if every one of them matches —
// sets the new password in the same call. Returns a generic error if
// anything doesn't match, without saying which field was wrong.
exports.resetPasswordWithIdentityCheck = onCall({ cors: true }, async (request) => {
  const { firstName, lastName, dateOfBirth, phone, email, newPassword } = request.data || {};

  if (!firstName || !lastName || !dateOfBirth || !phone || !email || !newPassword) {
    throw new HttpsError("invalid-argument", "All fields are required.");
  }
  if (newPassword.length < 8) {
    throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
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

  await admin.auth().updateUser(uid, { password: newPassword });

  return { ok: true };
});
