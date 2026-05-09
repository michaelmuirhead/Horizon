# Firebase setup for Horizon

This walks you through wiring `horizon-fc7b8` so you and your wife can sign in
on your own devices and share one household budget in real time. The app code
is already done — you just need to configure the Firebase project and paste
six values into `.env.local`.

Total time: ~10 minutes.

---

## 1. Get your web app config (the six env values)

1. Open the Firebase Console for the project:
   <https://console.firebase.google.com/u/0/project/horizon-fc7b8/overview>
2. Click the gear icon (top-left, next to "Project Overview") →
   **Project settings**.
3. Scroll down to **Your apps**.
   - If there's already a Web app listed, click it.
   - If not, click the `</>` (Web) icon, give it a nickname like "Horizon
     Web", **uncheck** the "Also set up Firebase Hosting" box (App Hosting is
     separate), and click **Register app**.
4. In the app's panel, switch the *SDK setup and configuration* radio to
   **Config**. You'll see a snippet like:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "horizon-fc7b8.firebaseapp.com",
     projectId: "horizon-fc7b8",
     storageBucket: "horizon-fc7b8.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123def456"
   };
   ```

5. Open `.env.local` (already created in the repo root with placeholders) and
   paste in the four values you don't already have:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `messagingSenderId` → `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`

   The other three (`authDomain`, `projectId`, `storageBucket`) are already
   prefilled with the standard `horizon-fc7b8` values — double-check them
   against the snippet just in case.

> These six values are public per Firebase's docs. Security is enforced by
> `firestore.rules` + the Authorized Domains list, not by hiding the API key.

---

## 2. Enable Google sign-in

The app uses `signInWithPopup(GoogleAuthProvider)` in
`components/auth/AuthContext.tsx`. You need to turn that provider on.

1. Go to **Build → Authentication** in the left nav, or:
   <https://console.firebase.google.com/u/0/project/horizon-fc7b8/authentication/providers>
2. Click **Get started** if this is the first time.
3. In the **Sign-in method** tab, click **Google** → toggle **Enable** →
   pick a project support email → **Save**.

That's it for auth — both you and your wife sign in with your own Google
accounts. No need to add either of you anywhere; any Google account that
hits the app and signs in will work.

---

## 3. Authorize the domains your app runs on

By default Firebase Auth only allows callbacks from `localhost` and the
`firebaseapp.com` domain. If you deploy to App Hosting (or a custom domain),
add it here.

1. Same Authentication page → **Settings** tab → **Authorized domains**.
2. `localhost` and `horizon-fc7b8.firebaseapp.com` should already be there.
3. **Add domain** for whatever you deploy under, e.g.
   `horizon-fc7b8.web.app` and any custom domain like `horizon.example.com`.

---

## 4. Paste the Firestore security rules

This is the page you linked. The rules are already written in
`firestore.rules` at the repo root and they match the schema in
`lib/cloudSync.ts` exactly.

1. Open the rules editor:
   <https://console.firebase.google.com/u/0/project/horizon-fc7b8/firestore/databases/-default-/security/rules>
2. If Firestore hasn't been initialized yet, the page will prompt you to
   **Create database** first. Pick a region close to you (e.g. `us-east1`),
   start in **production mode** (the rules from this repo lock things down
   safely), and create.
3. Open `firestore.rules` in the repo and copy its entire contents into the
   rules editor on the console page.
4. Click **Publish**.

> Optional: if you have the Firebase CLI installed (`npm i -g firebase-tools`,
> then `firebase login`), you can deploy the rules from the repo root with
> `firebase deploy --only firestore:rules` — `firebase.json` is already wired
> up for it.

---

## 5. Run the app and create a household

```bash
npm install
npm run dev
```

Then:

1. Open the app in your browser. The **Cloud Sync** section in Settings will
   now appear because `NEXT_PUBLIC_FIREBASE_*` is set.
2. Sign in with your Google account.
3. In Settings → Cloud Sync, click the option to create a shared household
   (the store wires this to `createHousehold` in `lib/cloudSync.ts`). You'll
   get a 12-character join code.
4. Send the code to your wife. She:
   - Opens the same app URL
   - Signs in with her Google account
   - Pastes the code into the join field
5. Done. Both of you are now reading and writing the same Firestore doc at
   `households/{hid}/budget/state` and changes propagate live via
   `onSnapshot`.

---

## 6. (Later) Wire env vars into App Hosting

`.env.local` only works locally. When you deploy with App Hosting, uncomment
the `env:` block in `apphosting.yaml` and paste the same values there so the
deployed build picks them up. The file already has the right shape — just
fill in the values and commit.

---

## Files touched in this setup

| File                  | What changed                                         |
| --------------------- | ---------------------------------------------------- |
| `.firebaserc`         | Default project set to `horizon-fc7b8`               |
| `.env.local`          | Created with project ID prefilled, 3 placeholders    |
| `firestore.rules`     | New — paste-ready rules matching `cloudSync.ts`      |
| `firebase.json`       | New — points the CLI at `firestore.rules`            |
| `FIREBASE_SETUP.md`   | This file                                            |

Nothing in `app/`, `components/`, or `lib/` was touched — the app code was
already complete.
