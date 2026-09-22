// ============================================================
// firebase-config.js
// PURPOSE: Connects StudyBuddy to your Firebase project.
// WHAT TO DO: Replace every value below with your own Firebase
//             project values from Firebase Console →
//             Project Settings → General → Your Apps → Web App
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase Config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDEtoUhxOYzI1PrpUrzsTQB3x1CjUnSQFI",
  authDomain:        "studybuddy-53a19.firebaseapp.com",
  projectId:         "studybuddy-53a19",
  storageBucket:     "studybuddy-53a19.firebasestorage.app",
  messagingSenderId: "334397945034",
  appId:             "1:334397945034:web:ff880e33728043a2c73033"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── EmailJS Config ────────────────────────────────────────────
// One universal template handles ALL emails (OTP, approval,
// rejection, reminders). We pass subject + message dynamically.
export const EMAILJS_CONFIG = {
  publicKey:  "Wvfl_ifH3R6tzLn26",
  serviceId:  "service_4xpjztg",
  templateId: "template_9hxgir7"
};

// ── Cloudinary Config ─────────────────────────────────────────
export const CLOUDINARY_CONFIG = {
  cloudName:    "dw8pqltyq",
  uploadPreset: "studybuddy"
};

// ── App Constants ─────────────────────────────────────────────
export const APP_NAME        = "StudyBuddy";
export const APP_URL         = "https://studybuddy8310.github.io/studybuddy";
export const SUPER_ADMIN_UID = "21Nu9CPOITWx3iRpGZql5bcaGSj1";
