# Opprett repo og push (automatisk)

Jeg kan ikke opprette repo på GitHub uten innlogging fra din maskin. Bruk scriptet:

1. Lag et **Personal access token** (classic):  
   https://github.com/settings/tokens  
   Hak av **repo** (full kontroll på private repos er nok med `repo`-scope for å opprette og pushe).

2. I PowerShell:

```powershell
cd "C:\Users\leonm\code\nff tracker"
$env:GITHUB_TOKEN = "lim_inn_token_her"
node scripts/create-repo-and-push.mjs
```

Valgfritt annet repo-navn:

```powershell
node scripts/create-repo-and-push.mjs mitt-repo-navn
```

Scriptet oppretter `nff-tracker` under GitHub-brukeren tokenet tilhører, pusher `main`, og setter `origin` uten token i URL etterpå.

---

## Manuelt (uten script)

1. **https://github.com/new** → tomt repo, f.eks. `nff-tracker`
2. `git remote add origin https://github.com/BRUKER/nff-tracker.git`
3. `git push -u origin main`

Slå på **GitHub Actions** på repoet så den daglige syncen kjører (`.github/workflows/update-stats.yml`).
