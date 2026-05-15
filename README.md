# 📚 StudyBuddy

A web-based study companion for CA Final & CA Intermediate students. Track your syllabus progress, practice MCQs, take mock tests, and build daily study streaks.

## 🌐 Live App

👉 **[Open StudyBuddy](https://studybuddy8310.github.io/studybuddy/)**



---

## 📱 Install as App (PWA)

StudyBuddy works as an installable app on Android and iOS — no app store needed.

### Android
1. Open the live link in **Chrome**
2. Tap the **⋮ menu** (top right)
3. Tap **"Add to Home screen"** or **"Install app"**
4. Tap **Install** — done!

### iPhone / iPad
1. Open the live link in **Safari**
2. Tap the **Share button** (box with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **Add** — done!

### Desktop (Chrome / Edge)
1. Open the live link
2. Click the **install icon** (⊕) in the address bar
3. Click **Install**

---

## 🚀 Deploy to GitHub Pages

1. **Create a new GitHub repository** (e.g. `studybuddy`)
2. Upload all files from this folder to the repo root
3. Go to **Settings → Pages**
4. Under *Source*, select **Deploy from a branch**
5. Choose **`main`** branch, **`/ (root)`** folder → click **Save**
6. Your app will be live at `https://YOUR-USERNAME.github.io/studybuddy/` in ~1 minute

> ⚠️ After deploying, update your **Firebase project's Authorized Domains** in the Firebase console:
> Firebase Console → Authentication → Settings → Authorized domains → Add `YOUR-USERNAME.github.io`

---

## 🔥 Firebase Setup

This app uses Firebase (Firestore + Auth). The config is in `js/firebase-config.js`.

- Enable **Email/Password** authentication
- Deploy the Firestore security rules from `firestore-rules.txt`
- Add your GitHub Pages domain to Firebase **Authorized Domains**

---

## 📁 Project Structure

```
studybuddy/
├── index.html              ← Login page (entry point)
├── manifest.json           ← PWA manifest
├── sw.js                   ← Service worker (offline support)
├── logo.png                ← App icon
├── css/
│   ├── global.css
│   ├── auth.css
│   ├── student.css
│   └── admin.css
├── js/
│   ├── firebase-config.js
│   └── utils/
├── student/                ← Student-facing pages
├── admin/                  ← Admin panel
└── superadmin/             ← Super admin login
```
