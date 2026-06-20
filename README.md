# 🧱 Stavitel Násobilek

Vzdělávací hra pro děti 6–10 let — procvičování násobilky a dělení stavěním domečku.

---

## 🚀 Spuštění na počítači (1 minuta)

### Co potřebuješ
- [Node.js](https://nodejs.org) — stáhni verzi **LTS** a nainstaluj

### Spuštění
1. Rozbal ZIP do složky (např. `C:\nasobilka` nebo `~/nasobilka`)
2. Otevři **příkazový řádek** (Windows: `cmd` nebo `PowerShell`, Mac: `Terminal`)
3. Přejdi do složky:
   ```
   cd C:\nasobilka
   ```
4. Nainstaluj závislosti (jen poprvé, trvá ~1 min):
   ```
   npm install
   ```
5. Spusť aplikaci:
   ```
   npm start
   ```
6. Automaticky se otevře prohlížeč na `http://localhost:3000`

---

## 📱 Spuštění v telefonu (Android) — přes domácí wi-fi

Po spuštění `npm start` na počítači:

1. Zjisti IP adresu svého počítače:
   - **Windows:** otevři cmd a napiš `ipconfig` → hledej "IPv4 Address" (např. `192.168.1.42`)
   - **Mac:** Systémové nastavení → Wi-Fi → Details → IP Address

2. Na Androidu otevři **Chrome** a zadej:
   ```
   http://192.168.1.42:3000
   ```
   (nahraď číslem ze svého počítače)

3. ✅ Aplikace běží v telefonu!

### Přidat na plochu jako ikonu (doporučeno)
1. V Chrome klepni na **⋮** (tři tečky vpravo nahoře)
2. Zvol **„Přidat na plochu"** nebo **„Nainstalovat aplikaci"**
3. Potvrď — na ploše se objeví ikona 🧱
4. Aplikace se otevře na celou obrazovku bez lišty prohlížeče

---

## 📁 Struktura projektu
```
nasobilka/
├── public/
│   ├── index.html       ← hlavní HTML
│   ├── manifest.json    ← PWA konfigurace
│   ├── sw.js            ← service worker (offline podpora)
│   ├── icon-192.png     ← ikona pro telefon
│   └── icon-512.png     ← ikona velká
├── src/
│   ├── index.js         ← vstupní bod React
│   └── App.jsx          ← celá hra
├── package.json
└── README.md
```

---

## ❓ Časté problémy

**„npm" není rozpoznán** → Nainstaluj Node.js z nodejs.org a restartuj cmd.

**Telefon se nepřipojí** → Ujisti se, že počítač i telefon jsou na stejné wi-fi. Zkontroluj IP adresu.

**Stránka se nenačte** → Zkontroluj, že `npm start` stále běží v cmd (nezavírej okno).
