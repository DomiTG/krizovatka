# 🚦 Křižovatka – Simulátor dopravní křižovatky

Interaktivní webová simulace čtyřramenné dopravní křižovatky s semafory, vozidly a chodci. Aplikace běží přímo v prohlížeči bez nutnosti instalace jakýchkoli závislostí nebo sestavovacích nástrojů.

---

## 📋 Obsah

- [Co aplikace dělá](#-co-aplikace-dělá)
- [Funkce](#-funkce)
- [Struktura souborů](#-struktura-souborů)
- [Instalace a spuštění](#-instalace-a-spuštění)
- [Ovládání](#-ovládání)
- [Nastavitelné parametry](#-nastavitelné-parametry)
- [Statistiky](#-statistiky)
- [Použité technologie](#-použité-technologie)

---

## 🚗 Co aplikace dělá

Aplikace simuluje provoz na čtyřramenné křižovatce v reálném čase. Na plátně o rozměru 700 × 700 px vidíte:

- **Vozidla** přijíždějící ze čtyř světových stran (sever, jih, východ, západ), která se řadí do fronty, čekají na zelený signál a projíždějí křižovatkou buď rovně, nebo zatáčejí doleva/doprava po Bézierových křivkách.
- **Semafory** umístěné u každého vjezdu do křižovatky automaticky střídají fáze zelená → žlutá pro každou osu (NS/EW) a zabraňují srážkám.
- **Chodce** na přechodech pro chodce u všech čtyř ramen. Čekají u obrubníku, dokud jejich přechod není bezpečný (protisměr svítí červenou), poté přejdou na druhou stranu.
- **Statistiky** v postranním panelu zobrazují počet projíždějících vozidel, aktuální fronty, průměrné a maximální časy čekání a celkový simulační čas.

---

## ✨ Funkce

- Plynulá animace pomocí `requestAnimationFrame` při ~60 FPS
- Automatické cykly semaforů (zelená → žlutá → přepnutí osy → opakování)
- **Manuální ovládání semaforů** – možnost přepnout osu ručně přes UI přepínač
- Fronta vozidel s bezpečnou vzdáleností a plynulým zpomalením/rozjezdem
- Průjezd křižovatkou po Bézierových křivkách (rovně, vlevo, vpravo)
- Srážkám zabraňující logika (protijedoucí vlevo blokují vjezd soupeřů)
- Náhodný výběr barvy vozidla a výběr odbočení (vážené pravděpodobnosti)
- Chodci křížící vozovku ve správnou chvíli
- Minimalistické světlé UI (TailwindCSS, bez tmavého režimu)
- Žádné závislosti ani sestavovací krok – čistý HTML + JS + CSS

---

## 📁 Struktura souborů

```
krizovatka/
├── index.html          # Hlavní HTML stránka (layout + UI)
├── tailwind.css        # Předpřipravený Tailwind CSS (utilities)
├── style.css           # Doplňkové styly (legacy)
└── js/
    ├── constants.js    # Konstanty (geometrie, výchozí hodnoty, enumerace, cesty Bézierových křivek)
    ├── utils.js        # Pomocné funkce (Bézierovy křivky, náhodné funkce, …)
    ├── TrafficLight.js # Řadič semaforů (automatická & manuální fáze, kreslení lamp)
    ├── Car.js          # Třída vozidla (stavový automat, pohyb, kreslení)
    ├── Pedestrian.js   # Třída chodce (čekání, přechod, kreslení)
    ├── Simulation.js   # Hlavní simulace (spawn, update, statistiky, kreslení scény)
    ├── UI.js           # Propojení HTML ovladačů se simulací
    └── main.js         # Vstupní bod (inicializace, herní smyčka)
```

---

## 🚀 Instalace a spuštění

Aplikace nevyžaduje žádný instalační krok, NPM, Node.js ani jiný nástroj. Stačí otevřít soubor `index.html` v prohlížeči.

### Možnost 1 – Přímé otevření souboru v prohlížeči

1. Stáhněte nebo naklonujte repozitář:
   ```bash
   git clone https://github.com/DomiTG/krizovatka.git
   cd krizovatka
   ```
2. Otevřete soubor `index.html` dvojklikem, nebo ho přetáhněte do okna prohlížeče.

> ⚠️ Některé prohlížeče mohou při otevírání souborů přes `file://` blokovat lokální skripty. Pokud simulace nenaběhne, použijte lokální HTTP server (viz níže).

### Možnost 2 – Lokální HTTP server (doporučeno)

**Python (3.x):**
```bash
cd krizovatka
python3 -m http.server 8080
```
Otevřete [http://localhost:8080](http://localhost:8080) v prohlížeči.

**Python (2.x):**
```bash
cd krizovatka
python -m SimpleHTTPServer 8080
```

**Node.js (npx):**
```bash
cd krizovatka
npx serve .
```
nebo
```bash
npx http-server . -p 8080
```

**VS Code – rozšíření Live Server:**
Nainstalujte rozšíření [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer), klikněte pravým tlačítkem na `index.html` a zvolte **Open with Live Server**.

---

## 🎮 Ovládání

Po spuštění simulace se na pravé straně zobrazí ovládací panel se třemi kartami.

### 🚦 Semafory

| Prvek | Popis |
|---|---|
| Barevné tečky (N/S, E/W) | Aktuální stav signálu – zelená / žlutá / červená |
| **Green duration** (posuvník) | Délka zelené fáze v sekundách (5 – 60 s) |
| **Yellow duration** (posuvník) | Délka žluté fáze v sekundách (1 – 10 s) |
| **Manual control** (přepínač) | Zapne manuální ovládání – automatická cyklizace se zastaví |
| **N/S Green** / **E/W Green** (tlačítka) | Ručně přepne zelenou na danou osu (viditelné jen v manuálním režimu) |

### 🚗 Simulace

| Prvek | Popis |
|---|---|
| **Spawn rate** | Počet vozidel za sekundu na každém vjezdu (0,05 – 1,5) |
| **Car speed** | Rychlost vozidel (0,5 – 6) |
| **Straight probability** | Pravděpodobnost jízdy rovně (0 – 1) |
| **Left probability** | Pravděpodobnost odbočení vlevo (0 – 1) |
| **Right probability** | Pravděpodobnost odbočení vpravo (0 – 1) |
| **⏸ Pause / ▶ Resume** | Pozastaví nebo obnoví simulaci |
| **↺ Reset** | Resetuje simulaci do výchozího stavu |

> Pravděpodobnosti odboček jsou automaticky normalizovány na součet 1, takže nemusíte dbát na přesné hodnoty.

---

## 📊 Statistiky

Panel zobrazuje živé statistiky aktualizované přibližně 10× za sekundu:

| Ukazatel | Popis |
|---|---|
| **Cars passed** | Celkový počet vozidel, která projela křižovatkou |
| **Active cars** | Aktuální počet vozidel na plátně |
| **Waiting** | Počet vozidel čekajících na červenou |
| **Sim time** | Uplynulý simulační čas |
| **Avg wait** | Průměrná čekací doba vozidla |
| **Max wait** | Maximální zaznamenaná čekací doba |

---

## 🛠 Použité technologie

| Technologie | Účel |
|---|---|
| **HTML5 Canvas API** | Kreslení simulace (vozidla, semafory, chodci, vozovka) |
| **Vanilla JavaScript (ES2015+)** | Logika simulace, UI, stavové automaty, Bézierovy křivky |
| **TailwindCSS v4** | Stylování UI panelu (utility-first CSS, světlý režim) |
| **requestAnimationFrame** | Plynulá herní smyčka |

Aplikace nemá žádné npm závislosti, frameworky ani sestavovací nástroje. Vše běží přímo v prohlížeči.
