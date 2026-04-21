# Push til GitHub (én gang)

Repoet finnes ikke på `github.com/leonlelo/nff-tracker` enda. Gjør dette:

1. Gå til **https://github.com/new**
2. **Repository name:** f.eks. `nff-tracker` (eller annet navn)
3. La den være **tom** (ingen README / .gitignore fra GitHub)
4. Klikk **Create repository**

5. I terminal, i mappen `nff tracker`:

```powershell
git remote add origin https://github.com/DITT-BRUKERNAVN/nff-tracker.git
git push -u origin main
```

(Bytt `DITT-BRUKERNAVN` og repo-navn om du valgte noe annet.)

Etter første push: slå på **GitHub Actions** for repoet (Settings → Actions → General → tillat workflows om det spørres).

Daglig oppdatering av `public/stats.json` skjer da automatisk via `.github/workflows/update-stats.yml`.
