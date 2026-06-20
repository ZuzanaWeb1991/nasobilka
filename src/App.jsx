import { useState, useEffect, useRef } from "react";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  sky: "#D6EEFF", skyMid: "#B8DDFF",
  grass: "#A8D5A2", grassDark: "#7BBD74",
  card: "#FFFFFF", cardShadow: "rgba(100,160,220,0.18)",
  accent: "#5BA4E0", accentLight: "#EBF5FF",
  textMain: "#2E4A6B", textSub: "#5A7FA8",
  green: "#4CAF7A", greenBg: "#E8F8EF",
  blue: "#5BA4E0", blueBg: "#EBF5FF",
  purple: "#9B7FD4", purpleBg: "#F2EDFF",
  wall: "#F5D97E", wallD: "#D4B84A", wallL: "#FFF3B0",
  roof: "#F0908A", roofD: "#C8605A", roofL: "#FFB8B0",
  ground: "#C4956A", groundD: "#A07850", groundL: "#E0B88A",
  door: "#C4956A", doorD: "#8A5530",
  window: "#7EC8E3", windowD: "#4A98B8",
  chimney: "#B0C4D8", chimneyD: "#7890A8",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Sound engine (Web Audio API — no external files needed) ──────────────────
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(freq, duration, type = "sine", startTime = 0, gainPeak = 0.18) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + startTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

const Sound = {
  enabled: true,
  // Cheerful two-note "ding" for correct answers
  correct() {
    if (!this.enabled) return;
    playTone(523.25, 0.16, "sine", 0);     // C5
    playTone(783.99, 0.22, "sine", 0.09);  // G5
  },
  // Soft, gentle blip for wrong answers — not punishing, just neutral feedback
  wrong() {
    if (!this.enabled) return;
    playTone(349.23, 0.18, "sine", 0, 0.12); // F4, low volume, single soft tone
  },
  // Short click for button taps
  tap() {
    if (!this.enabled) return;
    playTone(660, 0.06, "triangle", 0, 0.08);
  },
  // Bright ascending fanfare when a building is completed
  complete() {
    if (!this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => playTone(f, 0.28, "sine", i * 0.11, 0.16));
  },
};


const PRAISES = [
  "Jsi borec!", "Jen tak dál, borče!", "Jsi pravý stavitel!",
  "Skvělá práce!", "Mistr stavitel v akci!", "Tohle ti jde!",
  "Výborně!", "Paráda!", "Super práce!", "Další blok je na místě!",
  "Tvoje stavba vypadá skvěle!", "Ten domeček roste jedna radost!",
  "Pokračuj, staviteli!", "To se povedlo!", "Stavíš jako profesionál!",
];

const WRONG_MSGS = [
  () => "Skoro, staviteli! Tentokrát je správně",
  () => "Skoro, staviteli! Správný výsledek je",
  () => "To nevadí, staviteli. Správně je",
  () => "Každý stavitel se učí. Tentokrát je správně",
];

const COMPLETE_MSGS = [
  "Perfektní práce! Jsi mistr stavitel.",
  "Úžasné! Domeček je hotový.",
  "Skvělá práce! Postavil(a) jsi celý domeček.",
  "Výborně, staviteli! Stavba je dokončena.",
];

const STAGE_NAMES_BY_BUILDING = {
  house: ["", "Základy", "Levá stěna", "Pravá stěna", "Zadní stěna", "Přední stěna", "Okno", "Dveře", "Levá střecha", "Pravá střecha", "Komín ✨"],
  cottage: ["", "Kamenný základ", "Levá stěna", "Pravá stěna", "Dřevěné trámy", "Přední stěna", "Okrouhlé okénko", "Dřevěné dveře", "Slaměná střecha vlevo", "Slaměná střecha vpravo", "Komín s kouřem ✨"],
  tower: ["", "Kamenný základ", "Spodní patro", "Střední patro", "Horní patro", "Cimbuří", "Okénko", "Vstupní brána", "Kuželová střecha", "Špička střechy", "Vlaječka ✨"],
};

const BUILDING_TYPES = [
  { id: "house",   label: "Domeček",  emoji: "🏠" },
  { id: "cottage", label: "Chaloupka", emoji: "🛖" },
  { id: "tower",   label: "Věžička",  emoji: "🏯" },
];

function randomBuildingType() {
  return BUILDING_TYPES[Math.floor(Math.random() * BUILDING_TYPES.length)].id;
}

const BTN_COLORS = [
  "#7EC8E3","#8DD9A2","#F5D97E","#F5AD6E","#C3A8E3",
  "#7ED9C8","#C4956A","#B0C4D8","#F0908A","#7EC8E3",
];

// Shared glow/pop-in style for the newest building part across all three building variants
function glowStyle(idx, newStage) {
  return idx === newStage
    ? { filter: "drop-shadow(0 0 8px rgba(255,220,80,0.95))", animation: "partIn 0.45s cubic-bezier(.36,1.4,.64,1)" }
    : {};
}

// ── House SVG (variant: domeček) ────────────────────────────────────────────
function HouseBuilding({ stage, newStage }) {
  const glow = (idx) => glowStyle(idx, newStage);
  return (
    <svg viewBox="0 0 220 200" width="100%" style={{ display:"block", maxWidth:300, margin:"0 auto" }}>

      {stage >= 1 && (
        <g style={glow(1)}>
          <rect x="18" y="152" width="184" height="10" rx="3" fill={C.groundL} />
          <rect x="18" y="158" width="184" height="20" rx="3" fill={C.ground} />
          <rect x="18" y="158" width="8"   height="20" rx="2" fill={C.groundD} opacity="0.4" />
          <rect x="194" y="158" width="8"  height="20" rx="2" fill={C.groundD} opacity="0.3" />
        </g>
      )}
      {stage >= 2 && (
        <g style={glow(2)}>
          <rect x="30" y="88" width="22" height="70" rx="2" fill={C.wall} />
          <rect x="30" y="88" width="6"  height="70" fill={C.wallD} opacity="0.25" />
          <rect x="30" y="88" width="22" height="5"  rx="2" fill={C.wallL} opacity="0.6" />
        </g>
      )}
      {stage >= 3 && (
        <g style={glow(3)}>
          <rect x="168" y="88" width="22" height="70" rx="2" fill={C.wall} />
          <rect x="184" y="88" width="6"  height="70" rx="2" fill={C.wallD} opacity="0.3" />
          <rect x="168" y="88" width="22" height="5"  rx="2" fill={C.wallL} opacity="0.6" />
        </g>
      )}
      {stage >= 4 && (
        <g style={glow(4)}>
          <rect x="30" y="88" width="160" height="70" rx="2" fill={C.wallD} opacity="0.18" />
          <rect x="36" y="92" width="148" height="62" rx="1" fill={C.wallD} opacity="0.12" />
        </g>
      )}
      {stage >= 5 && (
        <g style={glow(5)}>
          <rect x="30" y="88" width="160" height="70" rx="2" fill={C.wall} />
          <rect x="30" y="88" width="8"   height="70" fill={C.wallD} opacity="0.2" />
          <rect x="182" y="88" width="8"  height="70" rx="2" fill={C.wallD} opacity="0.15" />
          <rect x="30" y="88" width="160" height="6"  rx="2" fill={C.wallL} opacity="0.55" />
        </g>
      )}
      {stage >= 6 && (
        <g style={glow(6)}>
          <rect x="48" y="100" width="42" height="34" rx="4" fill={C.windowD} />
          <rect x="51" y="103" width="36" height="28" rx="3" fill={C.window} />
          <rect x="68" y="103" width="3"  height="28" fill={C.windowD} opacity="0.5" />
          <rect x="51" y="116" width="36" height="3"  fill={C.windowD} opacity="0.5" />
          <rect x="53" y="105" width="10" height="7"  rx="2" fill="white" opacity="0.45" />
        </g>
      )}
      {stage >= 7 && (
        <g style={glow(7)}>
          <rect x="125" y="108" width="38" height="50" rx="4" fill={C.doorD} />
          <rect x="128" y="111" width="32" height="44" rx="3" fill={C.door} />
          <ellipse cx="144" cy="112" rx="16" ry="8" fill={C.door} />
          <ellipse cx="144" cy="112" rx="16" ry="8" fill={C.doorD} opacity="0.15" />
          <circle cx="156" cy="134" r="3" fill={C.doorD} />
          <rect x="130" y="120" width="28" height="2" rx="1" fill={C.doorD} opacity="0.3" />
          <rect x="130" y="126" width="28" height="2" rx="1" fill={C.doorD} opacity="0.2" />
        </g>
      )}
      {stage >= 8 && (
        <g style={glow(8)}>
          <polygon points="15,91 110,28 110,91" fill={C.roofL} />
          <polygon points="18,91 110,31 110,91" fill={C.roof} />
          <line x1="18" y1="91" x2="110" y2="31" stroke={C.roofD} strokeWidth="1"   opacity="0.2" />
          <line x1="40" y1="91" x2="110" y2="53" stroke={C.roofD} strokeWidth="0.8" opacity="0.15" />
          <line x1="65" y1="91" x2="110" y2="72" stroke={C.roofD} strokeWidth="0.8" opacity="0.15" />
        </g>
      )}
      {stage >= 9 && (
        <g style={glow(9)}>
          <polygon points="205,91 110,28 110,91" fill={C.roof} />
          <polygon points="202,91 110,31 110,91" fill={C.roofD} opacity="0.15" />
          <line x1="202" y1="91" x2="110" y2="31" stroke={C.roofD} strokeWidth="1"   opacity="0.2" />
          <line x1="178" y1="91" x2="110" y2="53" stroke={C.roofD} strokeWidth="0.8" opacity="0.15" />
          <line x1="152" y1="91" x2="110" y2="72" stroke={C.roofD} strokeWidth="0.8" opacity="0.15" />
          <line x1="110"  y1="28" x2="110" y2="91" stroke={C.roofD} strokeWidth="2.5" opacity="0.25" />
        </g>
      )}
      {stage >= 10 && (
        <g style={glow(10)}>
          <rect x="145" y="22" width="22" height="42" rx="3" fill={C.chimney} />
          <rect x="145" y="22" width="6"  height="42" fill={C.chimneyD} opacity="0.25" />
          <rect x="142" y="19" width="28" height="8"  rx="3" fill={C.chimneyD} opacity="0.4" />
          <rect x="143" y="20" width="26" height="6"  rx="2" fill={C.chimney} />
          <circle cx="156" cy="12" r="5" fill="white" opacity="0.7" />
          <circle cx="162" cy="7"  r="4" fill="white" opacity="0.5" />
          <circle cx="155" cy="4"  r="3" fill="white" opacity="0.35" />
        </g>
      )}
      {stage === 0 && (
        <text x="110" y="185" textAnchor="middle" fontSize="11" fill={C.textSub} opacity="0.6">
          Základy přijdou po první správné odpovědi!
        </text>
      )}
    </svg>
  );
}

// ── Cottage SVG (variant: chaloupka) ────────────────────────────────────────
function CottageBuilding({ stage, newStage }) {
  const glow = (idx) => glowStyle(idx, newStage);
  const stoneBase = "#C9BBA8", stoneBaseD = "#A89880", stoneBaseL = "#E5DBC9";
  const woodWall = "#D9B07C", woodWallD = "#B98A56", woodWallL = "#F0D2A8";
  const beam = "#8A5A35";
  const straw = "#E8C46A", strawD = "#C9A04A", strawL = "#F5DE96";
  const roundWindow = "#A8D8DD", roundWindowD = "#5FA8AE";
  const woodDoor = "#7A4E2E", woodDoorD = "#5C3A20";

  return (
    <svg viewBox="0 0 220 200" width="100%" style={{ display:"block", maxWidth:300, margin:"0 auto" }}>
      {/* 1. Kamenný základ — wide low stone foundation */}
      {stage >= 1 && (
        <g style={glow(1)}>
          <rect x="14" y="150" width="192" height="14" rx="4" fill={stoneBaseL} />
          <rect x="14" y="160" width="192" height="18" rx="4" fill={stoneBase} />
          <circle cx="35" cy="168" r="5" fill={stoneBaseD} opacity="0.3" />
          <circle cx="70" cy="170" r="6" fill={stoneBaseD} opacity="0.25" />
          <circle cx="120" cy="168" r="5" fill={stoneBaseD} opacity="0.3" />
          <circle cx="165" cy="170" r="6" fill={stoneBaseD} opacity="0.25" />
        </g>
      )}
      {/* 2. Levá stěna */}
      {stage >= 2 && (
        <g style={glow(2)}>
          <rect x="26" y="86" width="24" height="64" rx="2" fill={woodWall} />
          <rect x="26" y="86" width="6"  height="64" fill={woodWallD} opacity="0.3" />
          <rect x="26" y="86" width="24" height="5" rx="2" fill={woodWallL} opacity="0.5" />
        </g>
      )}
      {/* 3. Pravá stěna */}
      {stage >= 3 && (
        <g style={glow(3)}>
          <rect x="170" y="86" width="24" height="64" rx="2" fill={woodWall} />
          <rect x="188" y="86" width="6"  height="64" rx="2" fill={woodWallD} opacity="0.35" />
          <rect x="170" y="86" width="24" height="5" rx="2" fill={woodWallL} opacity="0.5" />
        </g>
      )}
      {/* 4. Dřevěné trámy — diagonal timber framing accents */}
      {stage >= 4 && (
        <g style={glow(4)}>
          <rect x="26" y="86" width="168" height="64" rx="2" fill={woodWallD} opacity="0.12" />
          <line x1="32" y1="92" x2="60" y2="146" stroke={beam} strokeWidth="4" opacity="0.5" />
          <line x1="188" y1="92" x2="160" y2="146" stroke={beam} strokeWidth="4" opacity="0.5" />
        </g>
      )}
      {/* 5. Přední stěna */}
      {stage >= 5 && (
        <g style={glow(5)}>
          <rect x="26" y="86" width="168" height="64" rx="2" fill={woodWall} />
          <rect x="26" y="86" width="168" height="6" rx="2" fill={woodWallL} opacity="0.5" />
          <line x1="60" y1="86" x2="60" y2="150" stroke={beam} strokeWidth="5" opacity="0.55" />
          <line x1="160" y1="86" x2="160" y2="150" stroke={beam} strokeWidth="5" opacity="0.55" />
          <line x1="26" y1="118" x2="194" y2="118" stroke={beam} strokeWidth="4" opacity="0.4" />
        </g>
      )}
      {/* 6. Okrouhlé okénko */}
      {stage >= 6 && (
        <g style={glow(6)}>
          <circle cx="158" cy="104" r="17" fill={roundWindowD} />
          <circle cx="158" cy="104" r="13" fill={roundWindow} />
          <line x1="158" y1="91" x2="158" y2="117" stroke={roundWindowD} strokeWidth="2" opacity="0.6" />
          <line x1="145" y1="104" x2="171" y2="104" stroke={roundWindowD} strokeWidth="2" opacity="0.6" />
          <circle cx="153" cy="99" r="3" fill="white" opacity="0.5" />
        </g>
      )}
      {/* 7. Dřevěné dveře */}
      {stage >= 7 && (
        <g style={glow(7)}>
          <rect x="48" y="104" width="36" height="46" rx="14" fill={woodDoorD} />
          <rect x="51" y="107" width="30" height="40" rx="11" fill={woodDoor} />
          <line x1="66" y1="110" x2="66" y2="144" stroke={woodDoorD} strokeWidth="2" opacity="0.5" />
          <circle cx="76" cy="128" r="2.5" fill={strawL} />
        </g>
      )}
      {/* 8. Slaměná střecha vlevo */}
      {stage >= 8 && (
        <g style={glow(8)}>
          <polygon points="10,89 110,26 110,89" fill={strawL} />
          <polygon points="14,89 110,30 110,89" fill={straw} />
          {Array.from({length:6}).map((_,i) => (
            <line key={i} x1={20+i*15} y1={87-i*1} x2={45+i*11} y2={89-i*9}
              stroke={strawD} strokeWidth="2.2" opacity="0.45" strokeLinecap="round" />
          ))}
        </g>
      )}
      {/* 9. Slaměná střecha vpravo */}
      {stage >= 9 && (
        <g style={glow(9)}>
          <polygon points="210,89 110,26 110,89" fill={straw} />
          <polygon points="206,89 110,30 110,89" fill={strawD} opacity="0.2" />
          {Array.from({length:6}).map((_,i) => (
            <line key={i} x1={200-i*15} y1={87-i*1} x2={175-i*11} y2={89-i*9}
              stroke={strawD} strokeWidth="2.2" opacity="0.4" strokeLinecap="round" />
          ))}
          <line x1="110" y1="26" x2="110" y2="89" stroke={strawD} strokeWidth="3" opacity="0.3" />
        </g>
      )}
      {/* 10. Komín s kouřem */}
      {stage >= 10 && (
        <g style={glow(10)}>
          <rect x="148" y="20" width="20" height="40" rx="2" fill={stoneBase} />
          <rect x="148" y="20" width="5"  height="40" fill={stoneBaseD} opacity="0.3" />
          <rect x="145" y="17" width="26" height="7" rx="2" fill={stoneBaseD} opacity="0.4" />
          <circle cx="158" cy="10" r="5" fill="white" opacity="0.7" />
          <circle cx="164" cy="5"  r="4" fill="white" opacity="0.5" />
          <circle cx="157" cy="2"  r="3" fill="white" opacity="0.35" />
        </g>
      )}
      {stage === 0 && (
        <text x="110" y="185" textAnchor="middle" fontSize="11" fill={C.textSub} opacity="0.6">
          Základy přijdou po první správné odpovědi!
        </text>
      )}
    </svg>
  );
}

// ── Tower SVG (variant: věžička) ─────────────────────────────────────────────
function TowerBuilding({ stage, newStage }) {
  const glow = (idx) => glowStyle(idx, newStage);
  const stone = "#B8C4D6", stoneD = "#8E9FB8", stoneL = "#DCE5F0";
  const stone2 = "#A8B6CC", stone2D = "#7E8FA8";
  const stone3 = "#9AAAC4", stone3D = "#728098";
  const roofCone = "#C3A8E3", roofConeD = "#9577BC", roofConeL = "#E0CFF5";
  const flagPole = "#7890A8";
  const flagColor = "#F0908A";
  const gateColor = "#8A5530", gateColorD = "#6A3D20";
  const windowColor = "#7EC8E3", windowColorD = "#4A98B8";

  const cx = 110; // tower center x
  const towerW = 60;
  const left = cx - towerW/2, right = cx + towerW/2;

  return (
    <svg viewBox="0 0 220 200" width="100%" style={{ display:"block", maxWidth:300, margin:"0 auto" }}>
      {/* 1. Kamenný základ */}
      {stage >= 1 && (
        <g style={glow(1)}>
          <rect x="55" y="158" width="110" height="16" rx="4" fill={stoneL} />
          <rect x="55" y="168" width="110" height="14" rx="4" fill={stoneD} opacity="0.5" />
        </g>
      )}
      {/* 2. Spodní patro */}
      {stage >= 2 && (
        <g style={glow(2)}>
          <rect x={left} y="118" width={towerW} height="44" rx="2" fill={stone3} />
          <rect x={left} y="118" width="8" height="44" fill={stone3D} opacity="0.3" />
          <rect x={right-8} y="118" width="8" height="44" fill={stone3D} opacity="0.25" />
          {/* brick lines */}
          <line x1={left} y1="138" x2={right} y2="138" stroke={stone3D} strokeWidth="1" opacity="0.25" />
        </g>
      )}
      {/* 3. Střední patro */}
      {stage >= 3 && (
        <g style={glow(3)}>
          <rect x={left+3} y="86" width={towerW-6} height="34" rx="2" fill={stone2} />
          <rect x={left+3} y="86" width="7" height="34" fill={stone2D} opacity="0.3" />
          <rect x={right-10} y="86" width="7" height="34" fill={stone2D} opacity="0.25" />
        </g>
      )}
      {/* 4. Horní patro */}
      {stage >= 4 && (
        <g style={glow(4)}>
          <rect x={left+6} y="58" width={towerW-12} height="30" rx="2" fill={stone} />
          <rect x={left+6} y="58" width="6" height="30" fill={stoneD} opacity="0.3" />
          <rect x={right-12} y="58" width="6" height="30" fill={stoneD} opacity="0.25" />
        </g>
      )}
      {/* 5. Cimbuří — castle crenellations on top */}
      {stage >= 5 && (
        <g style={glow(5)}>
          {[0,1,2,3,4].map(i => (
            <rect key={i} x={left+8+i*10} y="46" width="7" height="13" fill={stone} stroke={stoneD} strokeWidth="0.5" opacity={i%2===0?1:0.85} />
          ))}
        </g>
      )}
      {/* 6. Okénko */}
      {stage >= 6 && (
        <g style={glow(6)}>
          <rect x={cx-12} y="64" width="24" height="20" rx="10" fill={windowColorD} />
          <rect x={cx-9} y="67" width="18" height="14" rx="7" fill={windowColor} />
          <line x1={cx} y1="67" x2={cx} y2="81" stroke={windowColorD} strokeWidth="1.5" opacity="0.5" />
        </g>
      )}
      {/* 7. Vstupní brána */}
      {stage >= 7 && (
        <g style={glow(7)}>
          <rect x={cx-16} y="128" width="32" height="34" rx="14" fill={gateColorD} />
          <rect x={cx-13} y="131" width="26" height="28" rx="11" fill={gateColor} />
          <line x1={cx} y1="133" x2={cx} y2="157" stroke={gateColorD} strokeWidth="2" opacity="0.4" />
        </g>
      )}
      {/* 8. Kuželová střecha (base) */}
      {stage >= 8 && (
        <g style={glow(8)}>
          <polygon points={`${left-6},48 ${cx},10 ${right+6},48`} fill={roofConeL} />
          <polygon points={`${left-2},48 ${cx},14 ${right+2},48`} fill={roofCone} />
        </g>
      )}
      {/* 9. Špička střechy — roof detail lines + tip */}
      {stage >= 9 && (
        <g style={glow(9)}>
          <line x1={cx} y1="14" x2={cx} y2="48" stroke={roofConeD} strokeWidth="2" opacity="0.3" />
          <line x1={left+8} y1="46" x2={cx-4} y2="22" stroke={roofConeD} strokeWidth="1.5" opacity="0.25" />
          <line x1={right-8} y1="46" x2={cx+4} y2="22" stroke={roofConeD} strokeWidth="1.5" opacity="0.25" />
          <circle cx={cx} cy="11" r="4" fill={roofConeD} opacity="0.6" />
        </g>
      )}
      {/* 10. Vlaječka */}
      {stage >= 10 && (
        <g style={glow(10)}>
          <line x1={cx} y1="11" x2={cx} y2="-6" stroke={flagPole} strokeWidth="2.5" />
          <polygon points={`${cx},-6 ${cx+16},-1 ${cx},4`} fill={flagColor} />
        </g>
      )}
      {stage === 0 && (
        <text x="110" y="185" textAnchor="middle" fontSize="11" fill={C.textSub} opacity="0.6">
          Základy přijdou po první správné odpovědi!
        </text>
      )}
    </svg>
  );
}

// ── Building wrapper — selects which SVG variant to render ──────────────────
function BuildingStage({ buildingType, stage, newStage }) {
  const Comp =
    buildingType === "cottage" ? CottageBuilding :
    buildingType === "tower"   ? TowerBuilding :
    HouseBuilding;
  return (
    <>
      <svg width="0" height="0" style={{ position:"absolute" }}>
        <defs><style>{`
          @keyframes partIn {
            0%   { opacity:0; transform:translateY(-18px) scale(0.85); }
            60%  { opacity:1; transform:translateY(2px) scale(1.04); }
            100% { opacity:1; transform:translateY(0) scale(1); }
          }
        `}</style></defs>
      </svg>
      <Comp stage={stage} newStage={newStage} />
    </>
  );
}

// ── Sky & clouds ──────────────────────────────────────────────────────────────
function Cloud({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`} opacity="0.82">
      <rect x="10" y="20" width="60" height="18" rx="9"  fill="white" />
      <rect x="18" y="12" width="44" height="20" rx="10" fill="white" />
      <rect x="28" y="7"  width="30" height="17" rx="8"  fill="white" />
    </g>
  );
}
function SkyBackground() {
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:0, pointerEvents:"none",
      background:`linear-gradient(180deg, ${C.sky} 0%, ${C.skyMid} 55%, ${C.grass} 82%, ${C.grassDark} 100%)`,
    }}>
      <svg width="100%" height="100%" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
        <Cloud x={50}  y={30} s={1.1} />
        <Cloud x={290} y={14} s={0.8} />
        <Cloud x={570} y={38} s={1.3} />
        <Cloud x={695} y={10} s={0.7} />
      </svg>
    </div>
  );
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{
      background:C.card, borderRadius:22,
      boxShadow:`0 8px 32px ${C.cardShadow}`,
      padding:"24px 22px", ...style,
    }}>{children}</div>
  );
}

function Btn({ children, onClick, bg = C.accent, bgH, style = {} }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (bgH || bg + "cc") : bg,
        color:"white", border:"none", borderRadius:14, cursor:"pointer",
        padding:"14px 26px", fontSize:16, fontWeight:700,
        transition:"background 0.15s, transform 0.1s",
        transform: hov ? "translateY(-2px)" : "none",
        boxShadow: hov ? "0 6px 20px rgba(91,164,224,0.28)" : "0 3px 10px rgba(91,164,224,0.15)",
        ...style,
      }}>{children}</button>
  );
}

// ── Dot-grid visual hint (array model) — shows e.g. 4 rows × 7 dots ──────────
// For multiplication a×b: shown as `a` rows of `b` dots.
// For division a÷b: same grid (b rows of (a/b) dots), framed as "rozdělit na skupiny".
const DOT_COLORS = ["#7EC8E3","#8DD9A2","#F5D97E","#F5AD6E","#C3A8E3","#7ED9C8"];

function DotGridHint({ mode, a, b, answer, onClose }) {
  // a = rows, b = dots per row (always uses the smaller-friendly orientation)
  const rows = a;
  const cols = b;
  const dotColor = DOT_COLORS[(rows + cols) % DOT_COLORS.length];
  const total = rows * cols;
  const big = total > 40; // for larger products, group into tens for clarity
  const dotSize = big ? 11 : (cols > 7 || rows > 7 ? 14 : 18);
  const gap = big ? 3 : (cols > 7 || rows > 7 ? 4 : 6);
  const equation = mode === "mult" ? `${a} × ${b} = ${answer}` : `${a * b} ÷ ${a} = ${answer}`;

  return (
    <div
      onClick={onClose}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onClose(); }}
      style={{
        background: C.purpleBg, borderRadius:16, padding:"16px 14px",
        display:"flex", flexDirection:"column", alignItems:"center", gap:10,
        animation:"feedbackIn 0.3s cubic-bezier(.36,1.3,.64,1)",
        cursor:"pointer", position:"relative",
      }}
    >
      <span style={{
        position:"absolute", top:8, right:10, fontSize:12, color:C.purple, opacity:0.6, fontWeight:700,
      }}>
        ✕ zavřít
      </span>
      <p style={{ margin:0, fontSize:13, fontWeight:700, color:C.purple, textAlign:"center" }}>
        {mode === "mult"
          ? `${rows} ${rows === 1 ? "řada" : rows < 5 ? "řady" : "řad"} po ${cols}`
          : `Rozděl na ${rows} stejné ${rows === 1 ? "skupinu" : rows < 5 ? "skupiny" : "skupin"}`}
      </p>
      {big ? (
        // Grouped-by-ten layout: each row chunked into groups of 10 dots for easier counting
        <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"center" }}>
          {Array.from({ length: rows }).map((_, r) => {
            const groups = [];
            let remaining = cols;
            while (remaining > 0) { groups.push(Math.min(10, remaining)); remaining -= 10; }
            return (
              <div key={r} style={{ display:"flex", gap:8 }}>
                {groups.map((count, gi) => (
                  <div key={gi} style={{
                    display:"flex", gap, flexWrap:"wrap", maxWidth:120,
                    padding:"3px 5px", background:"rgba(255,255,255,0.5)", borderRadius:6,
                  }}>
                    {Array.from({ length: count }).map((_, c) => (
                      <div key={c} style={{
                        width:dotSize, height:dotSize, borderRadius:"50%",
                        background:dotColor, flexShrink:0,
                        animation:`dotPop 0.2s ease ${(r*cols+gi*10+c)*0.006}s both`,
                      }} />
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap, alignItems:"center" }}>
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} style={{ display:"flex", gap, flexWrap:"wrap", justifyContent:"center", maxWidth:240 }}>
              {Array.from({ length: cols }).map((_, c) => (
                <div key={c} style={{
                  width:dotSize, height:dotSize, borderRadius:"50%",
                  background:dotColor, flexShrink:0,
                  animation:`dotPop 0.25s ease ${(r*cols+c)*0.012}s both`,
                }} />
              ))}
            </div>
          ))}
        </div>
      )}
      <div style={{
        background:"rgba(255,255,255,0.6)", borderRadius:10,
        padding:"6px 16px", fontSize:18, fontWeight:800, color:C.purple,
        marginTop:2,
      }}>
        {equation}
      </div>
      <p style={{ margin:0, fontSize:12, color:C.textSub, textAlign:"center" }}>
        Klepnutím sem nápovědu schováš
      </p>
    </div>
  );
}

// ── Brick path — single-row progress visual (replaces the old side-by-side house) ─
// Shows a row of classic red bricks growing left-to-right along a path, one per
// correct answer, with empty dashed slots for what's still ahead. Compact enough
// to need zero scrolling on mobile, since it's a single horizontal strip.
function Brick({ filled, justPlaced }) {
  return (
    <div style={{
      flex:"1 1 0", minWidth:0, maxWidth:44,
      aspectRatio:"34/22", borderRadius:4,
      position:"relative", overflow:"hidden",
      background: filled ? "#D85A30" : "transparent",
      border: filled ? "1.5px solid #993C1D" : "2px dashed #5A7FA855",
      animation: justPlaced ? "brickPop 0.4s cubic-bezier(.36,1.5,.64,1)" : "none",
      boxShadow: filled ? "0 2px 4px rgba(153,60,29,0.25)" : "none",
    }}>
      {filled && (
        <>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:"25%", background:"#F0997B", opacity:0.8 }} />
          <div style={{ position:"absolute", top:"25%", left:0, right:0, height:1, background:"#993C1D", opacity:0.3 }} />
          <div style={{ position:"absolute", top:0, bottom:0, left:"50%", width:1, background:"#993C1D", opacity:0.25 }} />
        </>
      )}
    </div>
  );
}

function BrickPath({ stage, newStage, total = 10 }) {
  return (
    <div style={{ position:"relative", padding:"6px 0 4px" }}>
      <div style={{
        display:"flex", gap:"2%", justifyContent:"space-between",
        position:"relative", zIndex:1,
      }}>
        {Array.from({ length: total }).map((_, i) => (
          <Brick key={i} filled={i < stage} justPlaced={i === newStage - 1} />
        ))}
      </div>
    </div>
  );
}

// ── Number grid (shared by both sections on select screen) ────────────────────
function NumberGrid({ onSelect, accentColor }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12 }}>
      {[1,2,3,4,5,6,7,8,9,10].map((n,i) => {
        const [hov, setHov] = useState(false);
        return (
          <button key={n}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            onClick={() => { Sound.tap(); onSelect(n); }}
            style={{
              background: BTN_COLORS[i], border:"none", borderRadius:14,
              aspectRatio:"1", fontSize:20, fontWeight:800, color:C.textMain,
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
              transition:"transform 0.12s, box-shadow 0.12s",
              transform: hov ? "scale(1.1)" : "scale(1)",
              boxShadow: hov ? `0 6px 20px ${BTN_COLORS[i]}90` : `0 3px 8px ${BTN_COLORS[i]}60`,
            }}>
            {n}{accentColor === "mult" ? "×" : "÷"}
          </button>
        );
      })}
    </div>
  );
}

// ── Select screen ─────────────────────────────────────────────────────────────
function SelectScreen({ onStartMult, onStartDiv }) {
  return (
    <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", minHeight:"100vh", padding:"36px 16px", gap:24 }}>
      <div style={{ fontSize:52 }}>🧱</div>
      <h1 style={{ color:C.textMain, fontSize:"clamp(22px,4vw,34px)", fontWeight:900, margin:0, textAlign:"center" }}>
        Stavitel Násobilek
      </h1>
      <p style={{ color:C.textSub, fontSize:16, margin:0, textAlign:"center" }}>
        Vyber si příklad a postav svůj domeček!
      </p>

      {/* Násobilka */}
      <Card style={{ maxWidth:480, width:"100%" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <span style={{ fontSize:24 }}>✖️</span>
          <div>
            <div style={{ fontWeight:800, fontSize:17, color:C.textMain }}>Násobilka</div>
            <div style={{ fontSize:13, color:C.textSub }}>Procvičuj násobení — 10 příkladů, 10 částí domečku</div>
          </div>
        </div>
        <NumberGrid onSelect={onStartMult} accentColor="mult" />
      </Card>

      {/* Dělení */}
      <Card style={{ maxWidth:480, width:"100%" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <span style={{ fontSize:24 }}>➗</span>
          <div>
            <div style={{ fontWeight:800, fontSize:17, color:C.textMain }}>Dělení</div>
            <div style={{ fontSize:13, color:C.textSub }}>Procvičuj dělení — 10 příkladů, 10 částí domečku</div>
          </div>
        </div>
        <NumberGrid onSelect={onStartDiv} accentColor="div" />
      </Card>

      <p style={{ color:C.textSub, fontSize:13, opacity:0.7, textAlign:"center", margin:0 }}>
        Za každou správnou odpověď vyroste kus domečku!
      </p>
    </div>
  );
}

// ── Preview screen — shows the full row (e.g. 4×1 … 4×10) before starting ────
function PreviewScreen({ mode, number, onStart, onBack }) {
  const rows = [1,2,3,4,5,6,7,8,9,10].map(n =>
    mode === "mult"
      ? { left: `${number} × ${n}`, result: number * n }
      : { left: `${number * n} ÷ ${number}`, result: n }
  );
  const modeLabel = mode === "mult" ? `Násobilka ${number}×` : `Dělení ÷${number}`;
  const modeEmoji = mode === "mult" ? "✖️" : "➗";

  return (
    <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", minHeight:"100vh", padding:"32px 16px", gap:18 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, maxWidth:420, width:"100%" }}>
        <button onClick={onBack} style={{
          background:"rgba(255,255,255,0.72)", border:"none", borderRadius:10,
          padding:"7px 14px", cursor:"pointer", color:C.textSub, fontSize:13, fontWeight:600,
        }}>← Zpět</button>
      </div>

      <div style={{ fontSize:40 }}>{modeEmoji}</div>
      <h1 style={{ color:C.textMain, fontSize:"clamp(20px,4vw,28px)", fontWeight:900, margin:0, textAlign:"center" }}>
        {modeLabel}
      </h1>
      <p style={{ color:C.textSub, fontSize:14, margin:0, textAlign:"center", maxWidth:360 }}>
        Tady je celá řada, než začneš trénovat. Mrkni se na ni, ať víš, co tě čeká.
      </p>

      <Card style={{ maxWidth:420, width:"100%" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {rows.map((r, i) => (
            <div key={i} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              background: i % 2 === 0 ? C.accentLight : "transparent",
              borderRadius:10, padding:"8px 14px",
            }}>
              <span style={{ fontSize:16, fontWeight:700, color:C.textMain }}>{r.left} =</span>
              <span style={{ fontSize:18, fontWeight:900, color:C.accent }}>{r.result}</span>
            </div>
          ))}
        </div>
      </Card>

      <Btn onClick={onStart} style={{ maxWidth:420, width:"100%", fontSize:18, padding:"16px" }}>
        Začít trénovat 🚀
      </Btn>
    </div>
  );
}

// ── Shared GameScreen (works for both multiplication and division) ─────────────
function GameScreen({ mode, number, onComplete, onBack }) {
  // Build the 10 base facts for this number, in order (used for training phase)
  const orderedFacts = useState(() => {
    if (mode === "mult") {
      return [1,2,3,4,5,6,7,8,9,10].map(n => ({
        display: `${number} × ${n}`, answer: number * n, a: number, b: n,
      }));
    } else {
      return [1,2,3,4,5,6,7,8,9,10].map(n => ({
        display: `${number * n} ÷ ${number}`, answer: n, a: number, b: n,
      }));
    }
  })[0];

  // Two phases: "training" (in order 1×N..10×N) then "review" (shuffled)
  const [phase, setPhase] = useState("training"); // "training" | "review"
  const [reviewQuestions] = useState(() => shuffle(orderedFacts));

  const questions = phase === "training" ? orderedFacts : reviewQuestions;

  const [qIdx, setQIdx]         = useState(0);
  const [input, setInput]       = useState("");
  const [stage, setStage]       = useState(0);
  const [newStage, setNewStage] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef(null);

  const current = questions[qIdx];

  function focusInput() { setTimeout(() => inputRef.current?.focus(), 80); }

  function handleCheck() {
    if (!input.trim()) return;
    const val = parseInt(input, 10);
    if (val === current.answer) {
      const praise = PRAISES[Math.floor(Math.random() * PRAISES.length)];
      if (phase === "review") {
        const ns = stage + 1;
        setStage(ns);
        setNewStage(ns);
        setCorrectCount(c => c + 1);
        setFeedback({ type:"correct", praise, ns });
        if (qIdx + 1 >= questions.length) Sound.complete();
        else Sound.correct();
      } else {
        setFeedback({ type:"correct", praise, ns: stage });
        Sound.correct();
      }
    } else {
      const msgFn = WRONG_MSGS[Math.floor(Math.random() * WRONG_MSGS.length)];
      setFeedback({ type:"wrong", msgText: msgFn(), correctNum: current.answer });
      Sound.wrong();
    }
  }

  function handleNext() {
    const ns = feedback?.ns ?? stage;
    Sound.tap();
    setNewStage(null);
    setFeedback(null);
    setInput("");
    setShowHint(false);
    if (qIdx + 1 >= questions.length) {
      if (phase === "training") {
        // Move to review phase — this is where the building actually gets constructed
        setPhase("review");
        setQIdx(0);
        focusInput();
      } else {
        onComplete({ stage: ns, correctCount });
      }
    } else {
      setQIdx(i => i + 1);
      focusInput();
    }
  }

  // Global Enter listener — works regardless of what currently has focus,
  // so pressing Enter always advances (check answer / go to next) without needing to click.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (feedback) handleNext();
      else handleCheck();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function handleKey(e) {
    if (e.key === "Enter") {
      if (feedback) handleNext();
      else handleCheck();
    }
  }

  const modeLabel = mode === "mult" ? `Násobilka ${number}×` : `Dělení ÷${number}`;
  const modeEmoji = mode === "mult" ? "✖️" : "➗";
  const phaseLabel = phase === "training" ? "Trénink" : "Ověřovací kolo";
  const phaseEmoji = phase === "training" ? "📘" : "🎯";

  return (
    <div style={{ position:"relative", zIndex:1, minHeight:"100vh", padding:"20px 12px" }}>
      {/* Top bar */}
      <div style={{ display:"flex", alignItems:"center", gap:10, maxWidth:860, margin:"0 auto 12px", flexWrap:"wrap" }}>
        <button onClick={onBack} style={{
          background:"rgba(255,255,255,0.72)", border:"none", borderRadius:10,
          padding:"7px 14px", cursor:"pointer", color:C.textSub, fontSize:13, fontWeight:600,
        }}>← Zpět</button>
        <div style={{ flex:1 }} />
        <div style={{
          background:"rgba(255,255,255,0.82)", borderRadius:12,
          padding:"6px 14px", fontSize:13, fontWeight:700, color:C.textMain,
        }}>{modeEmoji} {modeLabel}</div>
        <div style={{
          background:"rgba(255,255,255,0.82)", borderRadius:12,
          padding:"6px 14px", fontSize:13, fontWeight:700, color:C.textMain,
        }}>Příklad {qIdx+1} / 10</div>
        <div style={{
          background:"rgba(255,255,255,0.82)", borderRadius:12,
          padding:"6px 14px", fontSize:13, fontWeight:600, color:C.textSub,
        }}>🧱 {stage}/10</div>
      </div>

      {/* Phase banner */}
      <div style={{ maxWidth:860, margin:"0 auto 16px", display:"flex", justifyContent:"center" }}>
        <div style={{
          background: phase === "training" ? C.accentLight : C.greenBg,
          borderRadius:12, padding:"8px 18px",
          display:"flex", alignItems:"center", gap:8,
        }}>
          <span style={{ fontSize:16 }}>{phaseEmoji}</span>
          <span style={{ fontSize:13, fontWeight:700, color: phase === "training" ? C.accent : C.green }}>
            {phaseLabel}
          </span>
          <span style={{ fontSize:12, color:C.textSub }}>
            {phase === "training" ? "— procvičujeme popořadě" : "— teď zamíchaně, jako ověření"}
          </span>
        </div>
      </div>

      {/* Brick progress path */}
      <Card style={{ maxWidth:600, margin:"0 auto 14px", padding:"14px 18px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <span style={{ fontSize:12, fontWeight:700, color:C.textSub, letterSpacing:0.3, textTransform:"uppercase" }}>
            🧱 Postup
          </span>
          <span style={{ fontSize:12, fontWeight:700, color:C.textSub }}>{stage}/10 cihel</span>
        </div>
        <BrickPath stage={stage} newStage={newStage} />
      </Card>

      {/* Question card */}
      <Card style={{ maxWidth:600, margin:"0 auto", display:"flex", flexDirection:"column", gap:0 }}>
        {!feedback && (
          <>
            <p style={{ color:C.textSub, fontSize:14, margin:"0 0 6px", textAlign:"center" }}>Kolik je</p>
            <div style={{
              fontSize:"clamp(36px,7vw,62px)", fontWeight:900, color:C.textMain,
              textAlign:"center", letterSpacing:-1, margin:"0 0 18px", lineHeight:1.1,
            }}>
              {current.display} ?
            </div>

            {!showHint && (
              <button
                onClick={() => { setShowHint(true); Sound.tap(); }}
                style={{
                  background:"none", border:`2px dashed ${C.purple}55`, borderRadius:12,
                  padding:"8px 14px", marginBottom:16, cursor:"pointer",
                  color:C.purple, fontSize:13, fontWeight:700,
                  display:"flex", alignItems:"center", gap:6, justifyContent:"center",
                }}
              >
                💡 Nevím si rady, ukaž puntíky
              </button>
            )}
            {showHint && (
              <div style={{ marginBottom:16 }}>
                <DotGridHint
                  mode={mode}
                  a={current.a}
                  b={current.b}
                  answer={current.answer}
                  onClose={() => { setShowHint(false); Sound.tap(); }}
                />
              </div>
            )}

            <input
              ref={inputRef}
              type="number"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              autoFocus
              placeholder="?"
              style={{
                width:"100%", boxSizing:"border-box",
                padding:"18px 20px", fontSize:34, fontWeight:800,
                border:`3px solid ${C.accentLight}`, borderRadius:16,
                outline:"none", textAlign:"center", color:C.textMain,
                background:C.accentLight, marginBottom:16, transition:"border 0.15s",
              }}
              onFocus={e => { e.target.style.borderColor = C.accent; }}
              onBlur={e => { e.target.style.borderColor = C.accentLight; }}
            />
            <Btn onClick={handleCheck} style={{ width:"100%", fontSize:18, padding:"16px" }}>
              Zkontrolovat ✓
            </Btn>
          </>
        )}

        {feedback?.type === "correct" && (
          <div style={{ textAlign:"center", padding:"16px 0", animation:"feedbackIn 0.4s cubic-bezier(.36,1.4,.64,1)" }}>
            <div style={{ fontSize:72, lineHeight:1, marginBottom:12, display:"inline-block", animation:"checkBounce 0.5s cubic-bezier(.36,1.5,.64,1)" }}>✅</div>
            <div style={{ fontSize:32, fontWeight:900, color:C.green, marginBottom:12, lineHeight:1.2 }}>
              {feedback.praise}
            </div>
            <div style={{ background:C.greenBg, borderRadius:14, padding:"14px 20px", color:C.green, fontWeight:700, fontSize:17, marginBottom:16 }}>
              {phase === "review"
                ? "🧱 Cihla přidána!"
                : "📘 Skvěle procvičeno!"}
            </div>
            <Btn onClick={handleNext} bg={C.green} style={{ width:"100%", fontSize:18, padding:"16px" }}>
              {qIdx + 1 >= questions.length
                ? (phase === "training" ? "Pokračovat na ověřovací kolo 🎯" : "Zobrazit výsledek 🏠")
                : "Další příklad →"}
            </Btn>
          </div>
        )}

        {feedback?.type === "wrong" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16, animation:"feedbackIn 0.35s cubic-bezier(.36,1.3,.64,1)" }}>
            <div style={{
              background:C.blueBg, borderRadius:18, padding:"24px 22px",
              display:"flex", flexDirection:"column", alignItems:"center", gap:14,
              border:`2px solid ${C.accent}22`,
            }}>
              <span style={{ fontSize:44, lineHeight:1, display:"inline-block", animation:"wobble 0.55s ease" }}>💡</span>
              <p style={{ color:C.textMain, fontWeight:700, fontSize:19, margin:0, lineHeight:1.5, textAlign:"center" }}>
                {feedback.msgText}
              </p>
              <div style={{
                background:C.accent, color:"white", borderRadius:16,
                padding:"14px 40px", fontSize:48, fontWeight:900, lineHeight:1,
                animation:"numberPop 0.45s cubic-bezier(.36,1.5,.64,1)",
                boxShadow:`0 4px 20px ${C.accent}55`,
              }}>
                {feedback.correctNum}
              </div>
            </div>
            <Btn onClick={handleNext} bg={C.accent} style={{ width:"100%", fontSize:18, padding:"16px" }}>
              Další příklad →
            </Btn>
          </div>
        )}

        {/* Progress dots */}
        <div style={{ display:"flex", gap:6, justifyContent:"center", marginTop:20 }}>
          {questions.map((_,i) => (
            <div key={i} style={{
              width:10, height:10, borderRadius:"50%",
              background: i < qIdx ? C.green : i === qIdx ? C.accent : C.accentLight,
              transition:"background 0.3s",
            }} />
          ))}
        </div>
      </Card>

      <style>{`
        @keyframes feedbackIn {
          0%   { opacity:0; transform:scale(0.88) translateY(12px); }
          70%  { opacity:1; transform:scale(1.03) translateY(-2px); }
          100% { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes checkBounce {
          0%   { transform:scale(0.3) rotate(-15deg); opacity:0; }
          55%  { transform:scale(1.25) rotate(6deg); opacity:1; }
          75%  { transform:scale(0.92) rotate(-3deg); }
          100% { transform:scale(1) rotate(0deg); }
        }
        @keyframes wobble {
          0%   { transform:rotate(0deg); }
          20%  { transform:rotate(-18deg) scale(1.15); }
          50%  { transform:rotate(14deg) scale(1.1); }
          75%  { transform:rotate(-8deg); }
          100% { transform:rotate(0deg); }
        }
        @keyframes numberPop {
          0%   { transform:scale(0.4); opacity:0; }
          65%  { transform:scale(1.18); opacity:1; }
          85%  { transform:scale(0.94); }
          100% { transform:scale(1); }
        }
        @keyframes dotPop {
          0%   { transform:scale(0); opacity:0; }
          70%  { transform:scale(1.2); opacity:1; }
          100% { transform:scale(1); }
        }
        @keyframes brickPop {
          0%   { transform:scale(0.3) translateY(-10px); opacity:0; }
          60%  { transform:scale(1.15) translateY(2px); opacity:1; }
          100% { transform:scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Complete screen ───────────────────────────────────────────────────────────
function CompleteScreen({ mode, number, buildingType, stage, correctCount, onRestart, onBack }) {
  const msg = COMPLETE_MSGS[correctCount === 10 ? 0 : correctCount >= 8 ? 1 : correctCount >= 5 ? 2 : 3];
  const stars = correctCount === 10 ? "⭐⭐⭐" : correctCount >= 8 ? "⭐⭐" : "⭐";
  const [showHouse, setShowHouse] = useState(false);
  useEffect(() => { setTimeout(() => setShowHouse(true), 200); }, []);

  const buildingMeta = BUILDING_TYPES.find(b => b.id === buildingType) || BUILDING_TYPES[0];
  const modeLabel = mode === "mult" ? `násobilku ${number}×` : `dělení ÷${number}`;

  return (
    <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", minHeight:"100vh", padding:"32px 16px", gap:20 }}>
      <Card style={{ maxWidth:420, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:4 }}>🎉</div>
        <div style={{ fontSize:26, marginBottom:8 }}>{stars}</div>
        <h2 style={{ color:C.textMain, fontSize:"clamp(22px,5vw,32px)", fontWeight:900, margin:"0 0 10px" }}>
          Gratulujeme!
        </h2>
        <p style={{ color:C.textSub, fontSize:15, margin:"0 0 20px" }}>
          Procvičil(a) jsi {modeLabel} a postavil(a) svoji {buildingMeta.label.toLowerCase()}!
        </p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", marginBottom:20 }}>
          {[["Správně", `${correctCount}/10`, C.green], ["Části", `${stage}/10`, C.accent]].map(([l,v,col]) => (
            <div key={l} style={{ background:col+"22", borderRadius:12, padding:"12px 22px", textAlign:"center" }}>
              <div style={{ fontSize:26, fontWeight:900, color:col }}>{v}</div>
              <div style={{ fontSize:12, color:C.textSub, fontWeight:600 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ background:C.accentLight, borderRadius:14, padding:"14px 18px", marginBottom:24 }}>
          <p style={{ color:C.blue, fontWeight:700, fontSize:15, margin:0 }}>{msg}</p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <Btn onClick={onRestart} bg={C.green} style={{ width:"100%" }}>
            🔁 Hrát znovu ({mode === "mult" ? `${number}×` : `÷${number}`})
          </Btn>
          <Btn onClick={onBack} bg={C.accent} style={{ width:"100%" }}>
            🏠 Zpět na výběr
          </Btn>
        </div>
      </Card>

      {showHouse && (
        <Card style={{ maxWidth:320, width:"100%", padding:"16px 12px" }}>
          <div style={{ textAlign:"center", marginBottom:6, fontSize:12, fontWeight:700, color:C.textSub, textTransform:"uppercase", letterSpacing:0.5 }}>
            {buildingMeta.emoji} Tvoje dokončená {buildingMeta.label.toLowerCase()}
          </div>
          <BuildingStage buildingType={buildingType} stage={10} newStage={null} />
        </Card>
      )}
    </div>
  );
}

// ── Sound toggle button (floating, visible on all screens) ───────────────────
function SoundToggle({ enabled, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label={enabled ? "Vypnout zvuk" : "Zapnout zvuk"}
      style={{
        position:"fixed", top:14, right:14, zIndex:50,
        background:"rgba(255,255,255,0.85)", border:"none", borderRadius:14,
        width:44, height:44, fontSize:20, cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:"0 3px 10px rgba(91,164,224,0.2)",
      }}
    >
      {enabled ? "🔊" : "🔇"}
    </button>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]     = useState("select");
  const [mode, setMode]         = useState(null);   // "mult" | "div"
  const [number, setNumber]     = useState(null);
  const [buildingType, setBuildingType] = useState(null);
  const [result, setResult]     = useState(null);
  const [gameKey, setGameKey]   = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  Sound.enabled = soundEnabled;

  function toggleSound() {
    setSoundEnabled(v => {
      const next = !v;
      Sound.enabled = next;
      if (next) Sound.tap();
      return next;
    });
  }

  function selectNumber(m, n) {
    setMode(m);
    setNumber(n);
    Sound.tap();
    setScreen("preview");
  }

  function startGame(m, n) {
    setMode(m);
    setNumber(n);
    setBuildingType(randomBuildingType());
    setGameKey(k => k + 1);
    setScreen("game");
  }

  return (
    <div style={{ fontFamily:"'Segoe UI','Nunito',system-ui,sans-serif", minHeight:"100vh", position:"relative" }}>
      <SkyBackground />
      <SoundToggle enabled={soundEnabled} onToggle={toggleSound} />
      {screen === "select" && (
        <SelectScreen
          onStartMult={n => selectNumber("mult", n)}
          onStartDiv={n  => selectNumber("div",  n)}
        />
      )}
      {screen === "preview" && (
        <PreviewScreen
          mode={mode}
          number={number}
          onStart={() => startGame(mode, number)}
          onBack={() => setScreen("select")}
        />
      )}
      {screen === "game" && (
        <GameScreen
          key={gameKey}
          mode={mode}
          number={number}
          onComplete={res => { setResult(res); setScreen("complete"); }}
          onBack={() => setScreen("select")}
        />
      )}
      {screen === "complete" && (
        <CompleteScreen
          mode={mode}
          number={number}
          buildingType={buildingType}
          stage={result.stage}
          correctCount={result.correctCount}
          onRestart={() => startGame(mode, number)}
          onBack={() => setScreen("select")}
        />
      )}
    </div>
  );
}
