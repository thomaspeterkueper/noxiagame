# NOXIA – Technisches Setup (Alpha 0.1)

Stand: Juli 2026  
Stack: Next.js 16 · Supabase · Vercel · Ably  
Kosten: 0 €/Monat im Free Tier  
Getestet auf: Windows 11, PowerShell

---

## Ergebnis dieses Setups

- Live-URL: https://noxiagame.vercel.app
- GitHub: https://github.com/thomaspeterkueper/noxiagame
- Supabase: https://rrsgswmmjynumwnnolhi.supabase.co
- Jeder `git push` auf `main` deployed automatisch auf Vercel

---

## 1. Software installieren

### Node.js
1. nodejs.org → **LTS** herunterladen (getestet: v24.16.0)
2. Installer durchklicken – Standardoptionen
3. Bei „Install necessary tools" (Chocolatey etc.) → **Haken lassen**

### Git
1. git-scm.com → Download for Windows
2. Installer durchklicken – Standardoptionen

### VS Code
1. code.visualstudio.com → Download
2. Installer – **unbedingt anhaken:**
   - „Add to PATH"
   - „Open with Code"

### Alles prüfen (Windows Terminal)
```powershell
node -v    # v24.16.0
npm -v     # 11.13.0
git -v     # git version 2.53.0.windows.1
code -v    # 1.122.1
```

---

## 2. CLI Tools installieren

### pnpm
```powershell
npm install -g pnpm
pnpm setup
```

**Terminal komplett schließen und neu öffnen.**

Falls pnpm danach nicht erkannt wird (Windows PATH-Problem):
```powershell
# Einmalig ausführen:
$env:PATH += ";C:\Users\DEIN-NAME\AppData\Roaming\npm"
[System.Environment]::SetEnvironmentVariable("PATH", $env:PATH, "User")
```
Terminal neu öffnen → `pnpm -v` sollte 11.5.0 zeigen.

### Vercel CLI
```powershell
pnpm add -g vercel
# Bei Frage "Choose which packages to build" → A drücken, Enter
vercel -v    # 54.6.1
```

### Supabase CLI
```powershell
pnpm add -g supabase
supabase --version    # 2.102.0
```

---

## 3. Accounts anlegen (alle kostenlos)

| Dienst | URL | Hinweis |
|--------|-----|---------|
| GitHub | github.com | Basis für alles |
| Vercel | vercel.com | Mit GitHub einloggen |
| Supabase | supabase.com | Neues Projekt anlegen |
| Ably | ably.com | API Key kopieren |

---

## 4. GitHub Repository anlegen

1. github.com → **+** → **New repository**
2. Name: `noxiagame` (noxia freihalten für Buchwebseite)
3. Visibility: **Private**
4. Nichts anhaken (kein README, kein .gitignore)
5. **Create repository**

---

## 5. Projektordner anlegen

```powershell
mkdir C:\Users\DEIN-NAME\projekte\noxia
cd C:\Users\DEIN-NAME\projekte\noxia
```

---

## 6. Next.js Projekt erstellen

```powershell
pnpm create next-app@latest .
```

Bei der Frage „Use recommended defaults?" → **Yes**

Falls Fehler `ERR_PNPM_IGNORED_BUILDS`:
```powershell
pnpm approve-builds
# → A drücken (alle), Enter, dann "Yes"
```

### Abhängigkeiten installieren
```powershell
pnpm add @supabase/supabase-js @supabase/ssr ably zustand date-fns
```

---

## 7. VS Code öffnen

```powershell
code .
```

---

## 8. Git einrichten und auf GitHub pushen

```powershell
git init
git add .
git commit -m "feat: initial setup"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/noxiagame.git
git push -u origin main
```

---

## 9. Supabase Projekt einrichten

1. supabase.com → **New project**
2. Name: `noxiagame`
3. Region: `eu-central-1` (Frankfurt)
4. Starkes Passwort setzen und **sicher speichern**
5. Warten bis Projekt bereit (~2 Min)
6. **Settings → API** → kopieren:
   - Project URL (`https://DEINE-REF.supabase.co`)
   - `anon public` Key
   - `service_role` Key (**geheim!**)

---

## 10. Umgebungsvariablen

### `.env.local` in VS Code anlegen

```powershell
code .env.local
```

Inhalt:
```env
NEXT_PUBLIC_SUPABASE_URL=https://DEINE-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dein-anon-key
SUPABASE_SERVICE_ROLE_KEY=dein-service-role-key
NEXT_PUBLIC_ABLY_API_KEY=
CRON_SECRET=
KNOWLEDGE_SOURCE=local
SSF_BASE_URL=https://solarsciencefoundation.vercel.app
```

`SSF_BASE_URL` ist die kanonische Basis-URL für NOXIA→SSF. `SSF_API_BASE_URL` ist veraltet und darf nur noch als rückwärtskompatibler Alias betrachtet werden.

CRON_SECRET generieren:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Wichtig:** `.env.local` wird nie auf GitHub gepusht –  
die `.gitignore` enthält `.env*` und schützt alle env-Dateien automatisch.

---

## 11. Vercel einrichten

### Login
```powershell
vercel login
# Browser öffnet sich → mit GitHub einloggen
```

### Projekt verknüpfen
```powershell
vercel link
```
- Which team? → Thomas' projects, Enter
- Link to existing project? → **N**
- Name? → `noxiagame`, Enter
- Directory? → Enter (aktueller Ordner)
- Connect repository? → **Y**

### Umgebungsvariablen setzen

```powershell
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Sensitive? → N
# Wert einfügen
# Umgebungen → A (alle), Enter

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Sensitive? → N  (anon key ist öffentlich)
# "How to proceed?" → Leave as is, Enter
# Wert einfügen
# Umgebungen → A, Enter

vercel env add SUPABASE_SERVICE_ROLE_KEY
# Sensitive? → Y  (dieser Key ist geheim!)
# Wert einfügen
# Umgebungen → A, Enter

vercel env add CRON_SECRET
# Sensitive? → Y
# Wert einfügen
# Umgebungen → A, Enter

vercel env add KNOWLEDGE_SOURCE
# Sensitive? → N
# Wert: local oder ssf
# Umgebungen → A, Enter

vercel env add SSF_BASE_URL
# Sensitive? → N
# Wert: https://solarsciencefoundation.vercel.app
# Umgebungen → A, Enter
```

### Deployen
```powershell
vercel --prod
```

✓ Live unter `https://noxiagame.vercel.app`

---

## 12. Cron-Jobs

`vercel.json` steuert die geplanten Server-Ticks.

Aktuell erwartete Crons:

```json
{
  "crons": [
    { "path": "/api/cron/population", "schedule": "0 8 * * *" },
    { "path": "/api/cron/prices", "schedule": "*/30 * * * *" },
    { "path": "/api/cron/orders", "schedule": "15 * * * *" }
  ]
}
```

---

## 13. Täglicher Workflow

```powershell
# Entwickeln
pnpm dev
# → http://localhost:3000

# Änderungen deployen
git add .
git commit -m "feat: beschreibung"
git push
# → Vercel deployed automatisch
```

---

## Projektstruktur (Ziel)
