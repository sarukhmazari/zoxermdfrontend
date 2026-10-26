# Zoxer Bot — Session Connect Frontend

A clean, production-ready, minimalist WhatsApp pairing interface built with React, Vite, Tailwind CSS, and shadcn/ui aesthetic principles.

Deploys independently on **Vercel**, securely interfacing with the persistent Zoxer Bot backend hosted on **AWS Lightsail**.

---

## 🚀 Features

- **Official WhatsApp Multi-Device Pairing:** Generates real 8-digit pairing codes (`XXXX-XXXX`) directly through Baileys.
- **One-Click Copy & Countdown:** Instant clipboard copy with feedback and live 5-minute validity timer.
- **Live Connection Polling:** Automatically polls the backend status until WhatsApp confirms authentication.
- **Automated Bot Enrollment:** Authenticated sessions are immediately persisted to Supabase and enrolled in official newsletter autofollow and autoreactions.
- **Service Health Check:** Real-time indicator displaying the live status of the AWS Lightsail backend.
- **Independent & Decoupled:** The frontend runs as a static/client-side application on Vercel without loading Baileys or WhatsApp sockets.

---

## 🛠️ Environment Configuration

Create a `.env` file in the `frontend/` directory (or configure Environment Variables in your Vercel Project Settings):

```env
# The public HTTPS base URL of your AWS Lightsail Zoxer Bot backend
# (Do NOT include a trailing slash)
VITE_API_BASE_URL=https://api.yourdomain.com
```

In local development:
```env
VITE_API_BASE_URL=http://localhost:3000
```

---

## 📦 Local Development

```bash
cd frontend
npm install
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173).

---

## 🌐 Deployment on Vercel

1. Push your repository to GitHub / GitLab.
2. In the [Vercel Dashboard](https://vercel.com/new), import your repository.
3. Configure the Project Settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add the Environment Variable in Vercel:
   - `VITE_API_BASE_URL`: The public HTTPS URL where your AWS Lightsail backend is accessible (e.g. `https://api.yourdomain.com`).
5. Click **Deploy**.

---

## 🖥️ AWS Lightsail Backend Setup

Your persistent WhatsApp bot and REST API run together on AWS Lightsail:

1. **Start Bot & API:**
   ```bash
   npm start
   ```
   This initializes both the WhatsApp socket engine and the REST API server on port `3000` (or `PORT` from `.env`).

2. **Reverse Proxy (Nginx with SSL):**
   Point your domain (e.g. `api.yourdomain.com`) to your Lightsail public IP with an Nginx reverse proxy:
   ```nginx
   server {
       server_name api.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
3. Secure with Certbot:
   ```bash
   sudo certbot --nginx -d api.yourdomain.com
   ```
4. Configure CORS in your bot `.env`:
   ```env
   CORS_ORIGIN=https://your-frontend-project.vercel.app
   ```
