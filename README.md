# LPCC Assistente Virtual

AI chat assistant for the Liga Portuguesa Contra o Cancro (Núcleo Regional do Sul).
It answers **only** from documents approved by LPCC and stored in a Google Drive folder.

- **Text chat and voice chat**: the person speaks, Gemini turns it into text, the answer is read aloud.
- **Gemini File Search**: finds the right passages in the approved documents.
- **Google Drive sync**: once a day (and on demand at `/admin`), the app copies new, changed and deleted files into File Search.
- **No storage**: conversations and voice recordings are never saved or logged.

## How it works

```
Google Drive folder ──(daily sync /api/sync)──▶ Gemini File Search store
                                                       │
Browser (chat page) ──▶ /api/chat ──▶ Gemini + File Search ──▶ answer + source
        │
        └── mic ──▶ /api/transcribe ──▶ Gemini (speech → text)
```

| Path | What it is |
|---|---|
| `/` | The chat page |
| `/admin` | "Sync now" button (password protected) |
| `/privacidade` | Privacy notice (**draft, LPCC must review**) |
| `app/api/chat` | Answers questions using File Search |
| `app/api/transcribe` | Turns voice recordings into text |
| `app/api/sync` | Mirrors the Drive folder into File Search |
| `lib/prompt.ts` | The assistant's rules (tone, safety, "I don't know" text) |

## Safety rules

1. It only answers from the approved documents. If an answer isn't backed by a retrieved
   document, the server replaces it with a standard "I couldn't find this" message plus LPCC's
   phone numbers, even if the AI wrote something.
2. No medical advice, diagnoses or treatment opinions.
3. Emergencies point to 112.
4. A disclaimer is always visible.

## Setup (use the **portuguesalcc@gmail.com** Google account)

### 1. Gemini API key
1. Sign in at <https://aistudio.google.com/apikey> as portuguesalcc@gmail.com.
2. Click **Create API key** and copy it.
3. **Important for privacy:** on Gemini's free tier, Google may use the prompts to improve its
   products. People will type health information, so turn on billing for the project
   (in AI Studio, under **Billing**). Paid-tier data is not used that way. Costs at this scale are usually small.

### 2. Service account (lets the app read Drive)
1. Go to <https://console.cloud.google.com> as portuguesalcc@gmail.com. You can reuse the project the API key was created in.
2. **APIs & Services → Library**, search for **Google Drive API** and click **Enable**.
3. **IAM & Admin → Service Accounts → Create service account**. Name it `lpcc-assistente`. Skip the optional steps.
4. Open the new service account → **Keys → Add key → Create new key → JSON**. A file downloads. Keep it private.
5. Copy the service account's e-mail (it looks like `lpcc-assistente@<project>.iam.gserviceaccount.com`).

### 3. Google Drive folder
1. In portuguesalcc@gmail.com's Drive, create a folder, e.g. **Assistente LPCC – Documentos aprovados**.
2. Upload the approved documents (PDF, Word, Google Docs, text…). Subfolders are included.
3. **Share** the folder with the service account e-mail from step 2.5, as **Viewer**.
4. Copy the folder ID from the address bar: `https://drive.google.com/drive/folders/<THIS PART>`.

Only put **approved, public-safe** documents in this folder. Everything in it can end up in answers.

### 4. Vercel environment variables
Vercel → project **lpcc-ai-assistant** → **Settings → Environment Variables**. Add each one for
Production and Preview:

| Name | Value |
|---|---|
| `GEMINI_API_KEY` | The key from step 1 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The **entire contents** of the JSON file from step 2.4 |
| `GOOGLE_DRIVE_FOLDER_ID` | The folder ID from step 3.4 |
| `CRON_SECRET` | Any long random text (Vercel uses it for the daily sync) |
| `ADMIN_SYNC_SECRET` | A password for the `/admin` page |

Optional: `GEMINI_MODEL` (default `gemini-2.5-flash`) and `HELPLINE_TEXT` (who to contact in
"I don't know" answers).

After adding them, open **Deployments**, click **⋯** on the latest one and choose **Redeploy**.

### 5. First sync
1. Open `https://<your-site>/admin`, type the `ADMIN_SYNC_SECRET` password and click **Sincronizar agora**.
2. The result shows which files were added. Wait 2–5 minutes for Gemini to finish processing them.
3. Open the chat and ask one of the suggested questions.

After that, the sync runs automatically every day at about 03:00 UTC. The free Vercel plan
allows one scheduled run per day. Use `/admin` when you need a change to appear sooner.

## Testing checklist

- [ ] Each suggested question gets a correct answer that lists **Fonte: …**
- [ ] A question that isn't in the documents (e.g. "Qual é a capital de França?") gives the "não encontrei" message
- [ ] A medical question ("Devo parar a quimioterapia?") is declined politely
- [ ] Voice works in **Chrome**, **Safari (iPhone)** and **Edge**. Recording formats differ between browsers; report any that fail.
- [ ] "Ouvir" reads the answer in Portuguese (the voice depends on the device)
- [ ] Edit a document in Drive, click **Sincronizar agora**, and the answer changes

## Known limits

- **No rate limiting.** Anyone with the link can use it, and each message costs Gemini credits. If abuse becomes a problem, add a rate-limit rule in Vercel → Firewall.
- **Strict "I don't know".** Greetings like "Olá" also get the "não encontrei" message, because only document-backed answers are shown. That's on purpose.
- **Read-aloud voice quality depends on the device.** It uses the browser's built-in voices.

## Development

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```
