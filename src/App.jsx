import React, { useState, useEffect, useRef, useCallback } from "react";

// ── 色票 ────────────────────────────────────────────────
const C = {
  paper: "#E9E7DF",
  card: "#F4F2EC",
  ink: "#1C1E1B",
  ink60: "#5A5D55",
  ink35: "#8C8F86",
  rule: "#D2CFC3",
  levain: "#B8860B",
  flour: "#8A9A7B",
  water: "#6E8CA0",
  salt: "#9B7B8A",
  extra: "#A8825C",
  warn: "#A34D3C",
  night: "#16181A",
};

const mono = "'SF Mono','JetBrains Mono',ui-monospace,Menlo,monospace";
const sans =
  "system-ui,-apple-system,'PingFang TC','Noto Sans TC','Microsoft JhengHei',sans-serif";

const KEY = "sourdough_v3";
const PHOTO = (id) => `sd_photo_${id}`;

// ── 預設資料 ─────────────────────────────────────────────
const DEFAULT_GEAR = [
  { id: 1, name: "焙雅客 OP-1089 ＋ 陶板" },
  { id: 2, name: "焙雅客 OP-1089 ＋ 鑄鐵鍋" },
];

const DEFAULT_BAKE = {
  preheatTemp: 250, preheatMin: 60,
  t1: 250, m1: 18,
  t2: 220, m2: 30,
  steamMl: 110,
  coolMin: 120,
};

const DEFAULT_STEPS = [
  { id: 1, name: "自解", detail: "麵粉與大部分的水拌到無乾粉，蓋起來靜置", min: 40 },
  { id: 2, name: "加酸種", detail: "酸種捏拌到看不出白色紋路", min: 15 },
  { id: 3, name: "加鹽", detail: "鹽與剩下的水捏勻。量麵團溫度，目標 26–27°C", min: 30 },
  { id: 4, name: "拉折 1", detail: "力道大，四邊各拉折一次", min: 30 },
  { id: 5, name: "拉折 2", detail: "力道中等", min: 30 },
  { id: 6, name: "拉折 3", detail: "力道轉輕", min: 30 },
  { id: 7, name: "拉折 4", detail: "只做輕柔翻面，之後不要再動它", min: 0 },
  { id: 8, name: "基礎發酵", detail: "看狀態：漲 60–70%、搖盆有果凍感、指壓緩慢回彈但留痕", min: 0 },
  { id: 9, name: "預整形", detail: "輕柔折成鬆散圓球，收口朝下，不蓋，讓表面結皮", min: 25 },
  { id: 10, name: "整形", detail: "收口確實捏合。檯面不撒粉，收口朝下拖轉 3–4 次建立張力", min: 0 },
  { id: 11, name: "冷藏", detail: "套袋進冰箱", min: 720 },
  { id: 12, name: "預熱", detail: "鍋子或陶板要真的燒透，這步不能偷時間", min: 60, link: "preheat" },
  { id: 13, name: "割線入爐", detail: "冷麵團倒扣。刀身 15–20 度，一刀劃過，深約 1cm", min: 0 },
  { id: 14, name: "前段烘烤", detail: "注水時站側面，蒸氣會往上竄", min: 18, link: "bake1" },
  { id: 15, name: "後段烘烤", detail: "看顏色不看時間，要到深褐色再出爐", min: 30, link: "bake2" },
  { id: 16, name: "放涼", detail: "移到網架，不要提早切", min: 120, link: "cool" },
];

const SCORE_KEYS = [
  ["height", "膨脹高度"], ["crumb", "氣孔開放"],
  ["crust", "外皮上色"], ["ear", "耳朵"], ["sour", "酸度"],
];

// ── 計算 ────────────────────────────────────────────────
function compute(cfg) {
  const H = cfg.hydration / 100;
  const s = cfg.saltPct / 100;
  const L = cfg.levainPct / 100;
  const hl = cfg.levainHyd / 100;
  const extras = cfg.extras || [];
  const extraSum = extras.reduce((a, e) => a + (Number(e.pct) || 0) / 100, 0);

  const flourTotal = cfg.total / (1 + H + s + extraSum);
  const waterTotal = flourTotal * H;
  const salt = flourTotal * s;
  const levain = flourTotal * L;
  const levainFlour = levain / (1 + hl);
  const levainWater = levain - levainFlour;
  const flourToAdd = flourTotal - levainFlour;
  const waterToAdd = waterTotal - levainWater;

  const blendSum = cfg.flours.reduce((a, f) => a + (Number(f.pct) || 0), 0) || 1;
  const flourRows = cfg.flours.map((f) => ({
    name: f.name,
    grams: (flourToAdd * (Number(f.pct) || 0)) / blendSum,
    pct: ((Number(f.pct) || 0) / blendSum) * 100,
  }));
  const extraRows = extras.map((e) => ({
    name: e.name,
    grams: flourTotal * ((Number(e.pct) || 0) / 100),
    pct: Number(e.pct) || 0,
  }));

  return {
    flourTotal, waterTotal, salt, levain, levainFlour, levainWater,
    flourToAdd, waterToAdd, flourRows, extraRows,
    valid: waterToAdd >= 0 && flourToAdd >= 0,
  };
}

const g = (n) => (Math.round(n * 10) / 10).toFixed(1);

function fmtDur(min) {
  if (!min) return "看狀態";
  if (min < 60) return `${min} 分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} 小時 ${m} 分` : `${h} 小時`;
}

function fmtClock(ms) {
  if (ms < 0) ms = 0;
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

function resolveMin(step, bake) {
  if (step.link === "preheat") return Number(bake.preheatMin) || 0;
  if (step.link === "bake1") return Number(bake.m1) || 0;
  if (step.link === "bake2") return Number(bake.m2) || 0;
  if (step.link === "cool") return Number(bake.coolMin) || 0;
  return Number(step.min) || 0;
}

// 由烘烤參數自動產生的那一句，使用者不用手打
function autoLine(step, bake, gearName) {
  if (step.link === "preheat")
    return `${gearName ? gearName + "，" : ""}${bake.preheatTemp}°C 預熱 ${bake.preheatMin} 分鐘`;
  if (step.link === "bake1")
    return `${bake.t1}°C${Number(bake.steamMl) > 0 ? `，注水 ${bake.steamMl}ml` : "，蓋蓋不注水"}`;
  if (step.link === "bake2") return `排蒸氣後降到 ${bake.t2}°C`;
  return "";
}

// 自動那句 ＋ 自己寫的備註
function resolveDetail(step, bake, gearName) {
  const a = autoLine(step, bake, gearName);
  const d = (step.detail || "").trim();
  if (a && d) return `${a}。${d}`;
  return a || d;
}

// ── 配方卡資料 ────────────────────────────────────────────
function buildCard({ name, date, cfg, bake, gearName, steps, scores, note }) {
  const r = compute(cfg);
  const rows = [
    ...r.flourRows.map((f) => ({ label: f.name, g: f.grams, note: `${Math.round(f.pct)}%` })),
    { label: "水", g: r.waterToAdd },
    { label: "酸種", g: r.levain, note: `${cfg.levainHyd}% 含水` },
    { label: "└ 內含麵粉", g: r.levainFlour, sub: true },
    { label: "└ 內含水", g: r.levainWater, sub: true },
    { label: "鹽", g: r.salt },
    ...r.extraRows.map((e) => ({ label: e.name, g: e.grams, note: `${e.pct}%` })),
  ];
  const stepRows = steps.map((s, i) => ({
    n: i + 1,
    name: s.name,
    dur: fmtDur(resolveMin(s, bake)),
    detail: resolveDetail(s, bake, gearName),
  }));
  return {
    name: name || "酸種鄉村麵包",
    date, gearName, cfg, bake, rows, stepRows, r, scores, note,
    summary: `${g(cfg.total)}g · 含水 ${(r.waterTotal / r.flourTotal * 100).toFixed(0)}% · 酸種 ${cfg.levainPct}%`,
    bakeLine: `${bake.preheatTemp}°C 預熱 ${bake.preheatMin} 分 → ${bake.t1}°C ${bake.m1} 分`
      + `${Number(bake.steamMl) > 0 ? `（注水 ${bake.steamMl}ml）` : "（蓋蓋）"}`
      + ` → ${bake.t2}°C ${bake.m2} 分`,
  };
}

function cardToText(c) {
  const L = [];
  L.push(`【${c.name}】`);
  L.push(`${c.date}　${c.summary}`);
  if (c.gearName) L.push(c.gearName);
  L.push("");
  L.push("── 配方 ──");
  c.rows.forEach((x) => {
    const pad = x.sub ? "  " : "";
    L.push(`${pad}${x.label}　${g(x.g)} g${x.note ? `　${x.note}` : ""}`);
  });
  L.push("");
  L.push(`總麵粉 ${g(c.r.flourTotal)} g　總水量 ${g(c.r.waterTotal)} g　`
    + `實際含水率 ${(c.r.waterTotal / c.r.flourTotal * 100).toFixed(1)}%`);
  L.push("");
  L.push("── 步驟 ──");
  c.stepRows.forEach((s) => {
    L.push(`${String(s.n).padStart(2, "0")} ${s.name}　${s.dur}`);
    if (s.detail) L.push(`   ${s.detail}`);
  });
  L.push("");
  L.push("── 烘烤 ──");
  L.push(c.bakeLine);
  L.push(`放涼 ${c.bake.coolMin} 分`);
  if (c.scores && Object.values(c.scores).some((v) => v > 0)) {
    L.push("");
    L.push("── 結果 ──");
    L.push(SCORE_KEYS.map(([k, label]) =>
      `${label} ${"●".repeat(c.scores[k] || 0)}${"○".repeat(5 - (c.scores[k] || 0))}`
    ).join("　"));
  }
  if (c.note) {
    L.push("");
    L.push("── 備註 ──");
    L.push(c.note);
  }
  return L.join("\n");
}

// ── 配方卡繪圖 ────────────────────────────────────────────
function drawCard(c) {
  const W = 820;
  const PAD = 52;
  const IW = W - PAD * 2;
  const dpr = 2;

  const probe = document.createElement("canvas").getContext("2d");
  const font = (size, weight = 400, family = "sans") =>
    `${weight} ${size}px ${family === "mono"
      ? '"SF Mono",Menlo,monospace'
      : 'system-ui,-apple-system,"PingFang TC","Noto Sans TC",sans-serif'}`;

  const wrap = (text, maxW, f) => {
    probe.font = f;
    const out = [];
    let line = "";
    for (const ch of String(text)) {
      if (ch === "\n") { out.push(line); line = ""; continue; }
      if (probe.measureText(line + ch).width > maxW && line) {
        out.push(line); line = ch;
      } else line += ch;
    }
    if (line) out.push(line);
    return out.length ? out : [""];
  };

  // 版面計算
  const ops = [];
  let y = PAD;

  const push = (h, fn) => { ops.push({ y, fn }); y += h; };

  push(0, () => {});
  // 標題區
  push(20, (x, ctx) => {
    ctx.fillStyle = C.levain;
    ctx.font = font(13, 600);
    ctx.fillText("SOURDOUGH FORMULA", PAD, x + 13);
  });
  const titleLines = wrap(c.name, IW, font(38, 700));
  titleLines.forEach((ln, i) => {
    push(46, (x, ctx) => {
      ctx.fillStyle = C.ink;
      ctx.font = font(38, 700);
      ctx.fillText(ln, PAD, x + 38);
    });
  });
  push(30, (x, ctx) => {
    ctx.fillStyle = C.ink60;
    ctx.font = font(17, 400, "mono");
    ctx.fillText(`${c.date}　${c.summary}`, PAD, x + 17);
  });
  if (c.gearName) {
    push(28, (x, ctx) => {
      ctx.fillStyle = C.ink60;
      ctx.font = font(16);
      ctx.fillText(c.gearName, PAD, x + 16);
    });
  }
  push(22, () => {});

  const section = (label) => {
    push(14, () => {});
    push(28, (x, ctx) => {
      ctx.fillStyle = C.ink;
      ctx.fillRect(PAD, x + 12, IW, 1.5);
      ctx.fillStyle = C.card;
      ctx.fillRect(PAD, x, probe.measureText(label).width + 24, 26);
      ctx.fillStyle = C.ink;
      ctx.font = font(15, 600);
      ctx.fillText(label, PAD + 2, x + 18);
    });
    push(8, () => {});
  };

  probe.font = font(15, 600);
  section("配方");
  c.rows.forEach((x0) => {
    push(30, (x, ctx) => {
      ctx.fillStyle = x0.sub ? C.ink60 : C.ink;
      ctx.font = font(x0.sub ? 15 : 17);
      ctx.fillText(x0.label, PAD + (x0.sub ? 16 : 0), x + 18);
      if (x0.note) {
        ctx.fillStyle = C.ink35;
        ctx.font = font(13, 400, "mono");
        ctx.fillText(x0.note, PAD + 200, x + 18);
      }
      ctx.fillStyle = x0.sub ? C.ink60 : C.ink;
      ctx.font = font(x0.sub ? 16 : 18, 500, "mono");
      const t = `${g(x0.g)} g`;
      ctx.fillText(t, PAD + IW - probe.measureText(t).width - 30, x + 18);
      ctx.strokeStyle = C.rule;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, x + 29.5); ctx.lineTo(PAD + IW, x + 29.5); ctx.stroke();
    });
  });
  push(16, (x, ctx) => {
    ctx.fillStyle = C.ink60;
    ctx.font = font(14, 400, "mono");
    ctx.fillText(
      `總麵粉 ${g(c.r.flourTotal)}g　總水量 ${g(c.r.waterTotal)}g　實際含水率 ${(c.r.waterTotal / c.r.flourTotal * 100).toFixed(1)}%`,
      PAD, x + 20
    );
  });
  push(22, () => {});

  section("步驟");
  c.stepRows.forEach((s) => {
    const dl = s.detail ? wrap(s.detail, IW - 46, font(14)) : [];
    const h = 26 + dl.length * 21 + 10;
    push(h, (x, ctx) => {
      ctx.fillStyle = C.ink35;
      ctx.font = font(13, 500, "mono");
      ctx.fillText(String(s.n).padStart(2, "0"), PAD, x + 18);
      ctx.fillStyle = C.ink;
      ctx.font = font(17, 600);
      ctx.fillText(s.name, PAD + 34, x + 18);
      ctx.fillStyle = s.dur === "看狀態" ? C.levain : C.ink60;
      ctx.font = font(14, 400, "mono");
      const t = s.dur;
      ctx.fillText(t, PAD + IW - probe.measureText(t).width - 20, x + 18);
      ctx.fillStyle = C.ink60;
      ctx.font = font(14);
      dl.forEach((ln, i) => ctx.fillText(ln, PAD + 34, x + 39 + i * 21));
    });
  });

  section("烘烤");
  wrap(c.bakeLine, IW, font(16)).forEach((ln) => {
    push(24, (x, ctx) => {
      ctx.fillStyle = C.ink;
      ctx.font = font(16);
      ctx.fillText(ln, PAD, x + 17);
    });
  });
  push(26, (x, ctx) => {
    ctx.fillStyle = C.ink60;
    ctx.font = font(15);
    ctx.fillText(`放涼 ${c.bake.coolMin} 分`, PAD, x + 16);
  });

  const hasScore = c.scores && Object.values(c.scores).some((v) => v > 0);
  if (hasScore) {
    section("結果");
    push(34, (x, ctx) => {
      let cx = PAD;
      SCORE_KEYS.forEach(([k, label]) => {
        ctx.fillStyle = C.ink60;
        ctx.font = font(13);
        ctx.fillText(label, cx, x + 14);
        const w = probe.measureText(label).width;
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = i < (c.scores[k] || 0) ? C.levain : C.rule;
          ctx.fillRect(cx + i * 9, x + 22, 6, 6);
        }
        cx += Math.max(w, 50) + 26;
      });
    });
  }

  if (c.note) {
    section("備註");
    wrap(c.note, IW, font(15)).forEach((ln) => {
      push(23, (x, ctx) => {
        ctx.fillStyle = C.ink60;
        ctx.font = font(15);
        ctx.fillText(ln, PAD, x + 16);
      });
    });
  }

  y += PAD;
  const H = y;

  const cv = document.createElement("canvas");
  cv.width = W * dpr;
  cv.height = H * dpr;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.fillStyle = C.card;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.levain;
  ctx.fillRect(0, 0, W, 5);
  ctx.textBaseline = "alphabetic";
  ops.forEach((op) => op.fn(op.y, ctx));
  return cv;
}

// ── 圖片壓縮 ─────────────────────────────────────────────
function shrink(file, maxSide = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("圖片讀取失敗"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("檔案讀取失敗"));
    reader.readAsDataURL(file);
  });
}

// ── 樣式與共用元件 ────────────────────────────────────────
const box = { background: C.card, border: `1px solid ${C.rule}`, borderRadius: 3, padding: 18 };
const inputBase = {
  background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 2,
  padding: "6px 8px", fontSize: 13, color: C.ink, outline: "none",
  fontFamily: sans, boxSizing: "border-box",
};
const ghostBtn = {
  fontSize: 12, color: C.ink60, background: "transparent",
  border: `1px dashed ${C.rule}`, borderRadius: 2,
  padding: "6px 11px", cursor: "pointer", fontFamily: sans,
};
const solidBtn = {
  padding: "10px 16px", background: C.ink, color: C.card, border: "none",
  borderRadius: 2, fontSize: 13, cursor: "pointer", fontFamily: sans,
};
const miniBtn = {
  width: 28, border: `1px solid ${C.rule}`, borderRadius: 2,
  background: "transparent", color: C.ink35, cursor: "pointer", fontSize: 13,
};

function Label({ children }) {
  return (
    <div style={{
      fontSize: 11, letterSpacing: "0.08em", color: C.ink60,
      textTransform: "uppercase", marginBottom: 8,
    }}>{children}</div>
  );
}

function Field({ label, value, onChange, suffix, step = 1 }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{
        display: "block", fontSize: 11, letterSpacing: "0.08em",
        color: C.ink60, marginBottom: 5, textTransform: "uppercase",
      }}>{label}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <input type="number" value={value} step={step} min={0}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%", background: "transparent", border: "none",
            borderBottom: `1.5px solid ${C.rule}`, padding: "4px 0",
            fontFamily: mono, fontSize: 22, color: C.ink, outline: "none",
          }} />
        <span style={{ fontFamily: mono, fontSize: 13, color: C.ink35 }}>{suffix}</span>
      </div>
    </label>
  );
}

function Row({ name, grams, note, color, indent }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 10, padding: "7px 0",
      borderBottom: `1px solid ${C.rule}`, paddingLeft: indent ? 18 : 0,
    }}>
      {color && <span style={{ width: 7, height: 7, borderRadius: 1, background: color, flexShrink: 0 }} />}
      <span style={{ fontSize: 14, color: indent ? C.ink60 : C.ink }}>{name}</span>
      {note && <span style={{ fontSize: 11, color: C.ink35, fontFamily: mono }}>{note}</span>}
      <span style={{ flex: 1 }} />
      <span style={{
        fontFamily: mono, fontSize: indent ? 14 : 16,
        color: indent ? C.ink60 : C.ink, fontVariantNumeric: "tabular-nums",
      }}>{g(grams)}</span>
      <span style={{ fontFamily: mono, fontSize: 11, color: C.ink35 }}>g</span>
    </div>
  );
}

function Stars({ value, onChange, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
      <span style={{ fontSize: 12, color: C.ink60, width: 76 }}>{label}</span>
      <div style={{ display: "flex", gap: 3 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => onChange(n === value ? 0 : n)}
            aria-label={`${label} ${n} 分`}
            style={{
              width: 20, height: 20, cursor: "pointer", padding: 0,
              border: `1px solid ${n <= value ? C.levain : C.rule}`,
              background: n <= value ? C.levain : "transparent", borderRadius: 2,
            }} />
        ))}
      </div>
    </div>
  );
}

function ScoreDots({ scores }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      {SCORE_KEYS.map(([k, label]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, color: C.ink35 }}>{label.slice(-2)}</span>
          <div style={{ display: "flex", gap: 2 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} style={{
                width: 6, height: 6, borderRadius: 1,
                background: n <= (scores?.[k] || 0) ? C.levain : C.rule,
              }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Photo({ id, onRemove }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await window.storage.get(PHOTO(id));
        if (alive && res) setSrc(res.value);
      } catch (e) { /* 照片已不存在 */ }
    })();
    return () => { alive = false; };
  }, [id]);
  return (
    <div style={{ position: "relative" }}>
      <div style={{
        width: 78, height: 78, borderRadius: 2, overflow: "hidden",
        background: C.paper, border: `1px solid ${C.rule}`,
      }}>
        {src && <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      </div>
      {onRemove && (
        <button onClick={() => onRemove(id)} aria-label="移除這張照片" style={{
          position: "absolute", top: -6, right: -6, width: 20, height: 20,
          borderRadius: 10, border: `1px solid ${C.rule}`, background: C.card,
          color: C.ink60, fontSize: 12, cursor: "pointer", lineHeight: 1, padding: 0,
        }}>×</button>
      )}
    </div>
  );
}

// ── 製作模式 ─────────────────────────────────────────────
function CookMode({ session, steps, bake, onUpdate, onExit, onFinish }) {
  const [now, setNow] = useState(Date.now());
  const beeped = useRef(false);
  const i = session.stepIndex;
  const step = steps[i];

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { beeped.current = false; }, [i]);

  const min = step ? resolveMin(step, bake) : 0;
  const timed = min > 0;
  const elapsed = session.paused
    ? session.pausedAt - session.startedAt - session.pausedTotal
    : now - session.startedAt - session.pausedTotal;
  const remain = min * 60000 - elapsed;
  const done = timed && remain <= 0;

  useEffect(() => {
    if (done && !beeped.current) {
      beeped.current = true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        const ac = new AC();
        const o = ac.createOscillator();
        const gn = ac.createGain();
        o.connect(gn); gn.connect(ac.destination);
        o.frequency.value = 880; gn.gain.value = 0.07;
        o.start(); o.stop(ac.currentTime + 0.4);
      } catch (e) { /* 音效不可用 */ }
    }
  }, [done]);

  if (!step) return null;

  const reset = (idx) => ({
    ...session, stepIndex: idx, startedAt: Date.now(),
    pausedTotal: 0, paused: false, pausedAt: 0,
  });
  const next = () => (i + 1 >= steps.length ? onFinish() : onUpdate(reset(i + 1)));
  const prev = () => i > 0 && onUpdate(reset(i - 1));
  const togglePause = () => onUpdate(session.paused
    ? { ...session, paused: false, pausedTotal: session.pausedTotal + (Date.now() - session.pausedAt), pausedAt: 0 }
    : { ...session, paused: true, pausedAt: Date.now() });
  const shift = (m) => onUpdate({ ...session, startedAt: session.startedAt - m * 60000 });

  const upcoming = steps.slice(i + 1, i + 4);
  const eta = new Date(session.startedAt + session.pausedTotal + min * 60000);
  const dark = (bg, fg, extra = {}) => ({
    padding: "11px 16px", background: bg, color: fg,
    border: bg === "transparent" ? "1px solid #3A3D40" : "none",
    borderRadius: 3, fontSize: 14, cursor: "pointer", fontFamily: sans, ...extra,
  });

  return (
    <div style={{
      position: "fixed", inset: 0, background: C.night, color: "#EDEBE4",
      zIndex: 60, display: "flex", flexDirection: "column",
      padding: 22, fontFamily: sans, overflowY: "auto",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: mono, fontSize: 12, color: "#8C8F86", letterSpacing: "0.1em" }}>
          {String(i + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
        </span>
        <div style={{ flex: 1, height: 2, background: "#2C2F32", borderRadius: 1 }}>
          <div style={{ width: `${(i / steps.length) * 100}%`, height: "100%", background: C.levain }} />
        </div>
        <button onClick={onExit} style={{
          background: "transparent", border: "none", color: "#8C8F86",
          fontSize: 13, cursor: "pointer", fontFamily: sans,
        }}>離開</button>
      </div>

      <div style={{
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "center", textAlign: "center", padding: "28px 0",
      }}>
        <div style={{ fontSize: 30, fontWeight: 600 }}>{step.name}</div>
        <div style={{ fontSize: 15, color: "#A9ACA3", marginTop: 10, maxWidth: 440, lineHeight: 1.65 }}>
          {resolveDetail(step, bake, session.gearName)}
        </div>
        {timed ? (
          <>
            <div style={{
              fontFamily: mono, fontSize: 60, marginTop: 26, lineHeight: 1,
              color: done ? C.levain : "#EDEBE4", fontVariantNumeric: "tabular-nums",
            }}>{fmtClock(remain)}</div>
            <div style={{ fontFamily: mono, fontSize: 12, color: "#8C8F86", marginTop: 8 }}>
              {done ? "時間到" : session.paused ? "已暫停"
                : `預計 ${eta.getHours()}:${String(eta.getMinutes()).padStart(2, "0")} 結束`}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
              <button onClick={togglePause} style={dark("transparent", "#A9ACA3")}>
                {session.paused ? "繼續" : "暫停"}
              </button>
              <button onClick={() => shift(-5)} style={dark("transparent", "#A9ACA3")}>＋5 分</button>
              <button onClick={() => shift(5)} style={dark("transparent", "#A9ACA3")}>−5 分</button>
            </div>
          </>
        ) : (
          <div style={{
            fontSize: 14, color: C.levain, marginTop: 26,
            border: `1px solid ${C.levain}`, borderRadius: 3, padding: "9px 16px",
          }}>這一步看麵團狀態，不計時</div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#6C6F68", letterSpacing: "0.08em", marginBottom: 6 }}>接下來</div>
          {upcoming.map((s) => (
            <div key={s.id} style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 13, color: "#8C8F86", padding: "3px 0",
            }}>
              <span>{s.name}</span>
              <span style={{ fontFamily: mono }}>{fmtDur(resolveMin(s, bake))}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={prev} disabled={i === 0}
          style={dark("transparent", i === 0 ? "#4A4D50" : "#A9ACA3", { flexShrink: 0 })}>上一步</button>
        <button onClick={next} style={dark(C.levain, C.night, { flex: 1, fontWeight: 600 })}>
          {i + 1 >= steps.length ? "完成，記錄這次" : "完成，下一步"}
        </button>
      </div>
    </div>
  );
}

// ── 配方卡分頁 ────────────────────────────────────────────
function CardTab({ card, onName }) {
  const [copied, setCopied] = useState(false);
  const text = cardToText(card);

  const download = () => {
    try {
      const cv = drawCard(card);
      cv.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${card.name}_${card.date}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }, "image/png");
    } catch (e) { /* 繪圖失敗 */ }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      setCopied(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
      <div style={box}>
        <Label>卡片</Label>
        <input value={card.name} onChange={(e) => onName(e.target.value)}
          placeholder="麵包名稱"
          style={{ ...inputBase, width: "100%", fontSize: 16, marginBottom: 14 }} />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <button onClick={download} style={solidBtn}>下載圖片</button>
          <button onClick={copy} style={{ ...solidBtn, background: "transparent", color: C.ink60, border: `1px solid ${C.rule}` }}>
            {copied ? "已複製" : "複製文字"}
          </button>
        </div>

        <Label>純文字版</Label>
        <textarea readOnly value={text} rows={16}
          onFocus={(e) => e.target.select()}
          style={{ ...inputBase, width: "100%", fontFamily: mono, fontSize: 11, lineHeight: 1.6, resize: "vertical" }} />
        <div style={{ fontSize: 12, color: C.ink35, marginTop: 8, lineHeight: 1.6 }}>
          圖片適合貼社團；文字版把每個變數都寫清楚了，貼給別人或貼進 AI 問診斷都直接可讀。
        </div>
      </div>

      {/* 預覽 */}
      <div style={{ ...box, padding: 24 }}>
        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.18em", color: C.levain }}>
          SOURDOUGH FORMULA
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 6px" }}>{card.name}</div>
        <div style={{ fontFamily: mono, fontSize: 12, color: C.ink60 }}>
          {card.date}　{card.summary}
        </div>
        {card.gearName && (
          <div style={{ fontSize: 13, color: C.ink60, marginTop: 4 }}>{card.gearName}</div>
        )}

        <div style={{ marginTop: 16, paddingTop: 6, borderTop: `1.5px solid ${C.ink}` }}>
          <Label>配方</Label>
          {card.rows.map((x, i) => (
            <Row key={i} name={x.label} grams={x.g} note={x.note} indent={x.sub} />
          ))}
          <div style={{ fontFamily: mono, fontSize: 11, color: C.ink60, marginTop: 8 }}>
            總麵粉 {g(card.r.flourTotal)}g　總水量 {g(card.r.waterTotal)}g　
            實際含水率 {(card.r.waterTotal / card.r.flourTotal * 100).toFixed(1)}%
          </div>
        </div>

        <div style={{ marginTop: 18, paddingTop: 6, borderTop: `1.5px solid ${C.ink}` }}>
          <Label>步驟</Label>
          {card.stepRows.map((s) => (
            <div key={s.n} style={{ display: "flex", gap: 10, padding: "5px 0" }}>
              <span style={{ fontFamily: mono, fontSize: 11, color: C.ink35, width: 18, flexShrink: 0 }}>
                {String(s.n).padStart(2, "0")}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{
                    fontFamily: mono, fontSize: 11,
                    color: s.dur === "看狀態" ? C.levain : C.ink35,
                  }}>{s.dur}</span>
                </div>
                {s.detail && (
                  <div style={{ fontSize: 12, color: C.ink60, lineHeight: 1.55, marginTop: 1 }}>
                    {s.detail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, paddingTop: 6, borderTop: `1.5px solid ${C.ink}` }}>
          <Label>烘烤</Label>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{card.bakeLine}</div>
          <div style={{ fontSize: 13, color: C.ink60 }}>放涼 {card.bake.coolMin} 分</div>
        </div>

        {card.scores && Object.values(card.scores).some((v) => v > 0) && (
          <div style={{ marginTop: 18, paddingTop: 6, borderTop: `1.5px solid ${C.ink}` }}>
            <Label>結果</Label>
            <ScoreDots scores={card.scores} />
          </div>
        )}

        {card.note && (
          <div style={{ marginTop: 18, paddingTop: 6, borderTop: `1.5px solid ${C.ink}` }}>
            <Label>備註</Label>
            <div style={{ fontSize: 13, color: C.ink60, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {card.note}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 主元件 ───────────────────────────────────────────────
export default function SourdoughStudio() {
  const [tab, setTab] = useState("recipe");
  const [recipeName, setRecipeName] = useState("酸種鄉村麵包");
  const [total, setTotal] = useState(750);
  const [hydration, setHydration] = useState(70);
  const [levainPct, setLevainPct] = useState(22);
  const [levainHyd, setLevainHyd] = useState(100);
  const [saltPct, setSaltPct] = useState(2);
  const [flours, setFlours] = useState([
    { id: 1, name: "嘉禾高筋", pct: 90 },
    { id: 2, name: "全麥", pct: 10 },
  ]);
  const [extras, setExtras] = useState([]);
  const [gears, setGears] = useState(DEFAULT_GEAR);
  const [gearId, setGearId] = useState(1);
  const [bake, setBake] = useState(DEFAULT_BAKE);
  const [steps, setSteps] = useState(DEFAULT_STEPS);
  const [logs, setLogs] = useState([]);
  const [session, setSession] = useState(null);
  const [draft, setDraft] = useState(null);
  const [cardLogId, setCardLogId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const cfg = {
    total: Number(total) || 0, hydration: Number(hydration) || 0,
    levainPct: Number(levainPct) || 0, levainHyd: Number(levainHyd) || 100,
    saltPct: Number(saltPct) || 0, flours, extras,
  };
  const r = compute(cfg);
  const gear = gears.find((x) => x.id === gearId) || gears[0];
  const gearName = gear ? gear.name : "";

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(KEY);
        if (res) {
          const d = JSON.parse(res.value);
          if (d.logs) setLogs(d.logs);
          if (d.gears) setGears(d.gears);
          if (d.gearId) setGearId(d.gearId);
          if (d.bake) setBake({ ...DEFAULT_BAKE, ...d.bake });
          if (d.steps) setSteps(d.steps);
          if (d.session) setSession(d.session);
          if (d.recipeName) setRecipeName(d.recipeName);
          if (d.last) {
            const l = d.last;
            setTotal(l.total); setHydration(l.hydration);
            setLevainPct(l.levainPct); setLevainHyd(l.levainHyd);
            setSaltPct(l.saltPct); setFlours(l.flours); setExtras(l.extras || []);
          }
        }
      } catch (e) { /* 第一次使用 */ }
      setLoading(false);
    })();
  }, []);

  const stateRef = useRef({});
  stateRef.current = { cfg, logs, gears, gearId, bake, steps, session, recipeName };

  const persist = useCallback(async (patch = {}) => {
    const s = stateRef.current;
    try {
      await window.storage.set(KEY, JSON.stringify({
        last: s.cfg, logs: s.logs, gears: s.gears, gearId: s.gearId,
        bake: s.bake, steps: s.steps, session: s.session,
        recipeName: s.recipeName, ...patch,
      }));
    } catch (e) { /* 儲存失敗不中斷 */ }
  }, []);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => persist(), 400);
    return () => clearTimeout(t);
  }, [loading, session, logs, gears, gearId, bake, steps, recipeName, total,
      hydration, levainPct, levainHyd, saltPct, flours, extras, persist]);

  const startCook = () => setSession({
    stepIndex: 0, startedAt: Date.now(), pausedTotal: 0, paused: false, pausedAt: 0,
    cfg: JSON.parse(JSON.stringify(cfg)), gearName, bake: { ...bake }, name: recipeName,
  });

  const newDraft = (src) => ({
    id: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    name: src ? src.name : recipeName,
    cfg: src ? src.cfg : JSON.parse(JSON.stringify(cfg)),
    gearName: src ? src.gearName : gearName,
    bake: src ? src.bake : { ...bake },
    steps: JSON.parse(JSON.stringify(steps)),
    scores: { height: 0, crumb: 0, crust: 0, ear: 0, sour: 0 },
    note: "", photos: [],
  });

  const finishCook = () => {
    const s = session;
    setSession(null);
    setDraft(newDraft(s));
    setTab("log");
  };

  const addPhotos = async (files) => {
    if (!files || !files.length || !draft) return;
    setBusy("處理照片⋯");
    const ids = [...draft.photos];
    for (const f of Array.from(files).slice(0, 4)) {
      try {
        const data = await shrink(f);
        const pid = `${draft.id}_${Math.random().toString(36).slice(2, 8)}`;
        await window.storage.set(PHOTO(pid), data);
        ids.push(pid);
      } catch (e) { /* 略過失敗的檔案 */ }
    }
    setDraft({ ...draft, photos: ids });
    setBusy("");
  };

  const dropPhoto = async (pid) => {
    setDraft({ ...draft, photos: draft.photos.filter((p) => p !== pid) });
    try { await window.storage.delete(PHOTO(pid)); } catch (e) { /* 已不存在 */ }
  };

  const saveLog = async () => {
    const next = [draft, ...logs];
    setLogs(next); setDraft(null);
    await persist({ logs: next });
  };

  const delLog = async (l) => {
    const next = logs.filter((x) => x.id !== l.id);
    setLogs(next);
    if (cardLogId === l.id) setCardLogId(null);
    for (const p of l.photos || []) {
      try { await window.storage.delete(PHOTO(p)); } catch (e) { /* 已不存在 */ }
    }
    await persist({ logs: next });
  };

  const loadCfg = (c) => {
    setTotal(c.total); setHydration(c.hydration); setLevainPct(c.levainPct);
    setLevainHyd(c.levainHyd); setSaltPct(c.saltPct);
    setFlours(c.flours); setExtras(c.extras || []);
    setTab("recipe");
  };

  const bar = [
    ...r.flourRows.map((f, i) => ({ w: f.grams, c: C.flour, o: 1 - i * 0.22 })),
    { w: r.waterToAdd, c: C.water, o: 1 },
    { w: r.levain, c: C.levain, o: 1 },
    { w: r.salt, c: C.salt, o: 1 },
    ...r.extraRows.map((e) => ({ w: e.grams, c: C.extra, o: 1 })),
  ].filter((b) => b.w > 0);
  const barTotal = bar.reduce((a, b) => a + b.w, 0) || 1;
  const totalMin = steps.reduce((a, s) => a + resolveMin(s, bake), 0);

  const activeLog = cardLogId ? logs.find((l) => l.id === cardLogId) : null;
  const card = activeLog
    ? buildCard({
        name: activeLog.name || recipeName, date: activeLog.date, cfg: activeLog.cfg,
        bake: activeLog.bake || bake, gearName: activeLog.gearName,
        steps: activeLog.steps || steps, scores: activeLog.scores, note: activeLog.note,
      })
    : buildCard({
        name: recipeName, date: new Date().toISOString().slice(0, 10),
        cfg, bake, gearName, steps, scores: null, note: "",
      });

  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setTab(id)} style={{
      padding: "7px 14px", background: tab === id ? C.ink : "transparent",
      color: tab === id ? C.card : C.ink60,
      border: `1px solid ${tab === id ? C.ink : C.rule}`,
      borderRadius: 2, fontSize: 13, cursor: "pointer", fontFamily: sans,
    }}>{label}</button>
  );

  return (
    <div style={{ fontFamily: sans, background: C.paper, color: C.ink, padding: 20, minHeight: "100%" }}>
      {session && (
        <CookMode session={session} steps={steps} bake={session.bake || bake}
          onUpdate={setSession} onExit={() => setSession(null)} onFinish={finishCook} />
      )}

      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", color: C.levain, marginBottom: 4 }}>
            BAKER&apos;S PERCENTAGE
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>酸種配方台</h1>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          {tabBtn("recipe", "配方")}
          {tabBtn("steps", "步驟")}
          {tabBtn("card", "配方卡")}
          {tabBtn("log", `紀錄${logs.length ? ` ${logs.length}` : ""}`)}
          <span style={{ flex: 1 }} />
          {session && (
            <button onClick={() => setSession({ ...session })} style={{
              padding: "7px 14px", background: C.levain, color: C.night,
              border: "none", borderRadius: 2, fontSize: 13, cursor: "pointer", fontFamily: sans,
            }}>回到製作中的第 {session.stepIndex + 1} 步</button>
          )}
        </div>

        {/* ── 配方 ── */}
        {tab === "recipe" && (
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))" }}>
            <div>
              <div style={box}>
                <Label>名稱</Label>
                <input value={recipeName} onChange={(e) => setRecipeName(e.target.value)}
                  style={{ ...inputBase, width: "100%", fontSize: 15, marginBottom: 18 }} />
                <div style={{ display: "grid", gap: 16 }}>
                  <Field label="總麵團重量" value={total} onChange={setTotal} suffix="g" step={50} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Field label="總含水率" value={hydration} onChange={setHydration} suffix="%" />
                    <Field label="鹽" value={saltPct} onChange={setSaltPct} suffix="%" step={0.1} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Field label="酸種比例" value={levainPct} onChange={setLevainPct} suffix="%" />
                    <Field label="酸種含水率" value={levainHyd} onChange={setLevainHyd} suffix="%" step={10} />
                  </div>
                </div>

                <div style={{ marginTop: 22 }}>
                  <Label>麵粉配比</Label>
                  {flours.map((f, i) => (
                    <div key={f.id} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <input value={f.name} onChange={(e) => {
                        const n = [...flours]; n[i] = { ...f, name: e.target.value }; setFlours(n);
                      }} style={{ ...inputBase, flex: 1, minWidth: 0 }} />
                      <input type="number" value={f.pct} onChange={(e) => {
                        const n = [...flours]; n[i] = { ...f, pct: e.target.value }; setFlours(n);
                      }} style={{ ...inputBase, width: 62, fontFamily: mono }} />
                      <button onClick={() => setFlours(flours.filter((x) => x.id !== f.id))}
                        disabled={flours.length === 1}
                        style={{ ...miniBtn, cursor: flours.length === 1 ? "default" : "pointer" }}>−</button>
                    </div>
                  ))}
                  <button onClick={() => setFlours([...flours, { id: Date.now(), name: "新麵粉", pct: 10 }])}
                    style={ghostBtn}>＋ 加一種麵粉</button>
                </div>

                <div style={{ marginTop: 20 }}>
                  <Label>其他配料（佔麵粉 %）</Label>
                  {extras.map((e, i) => (
                    <div key={e.id} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <input value={e.name} onChange={(ev) => {
                        const n = [...extras]; n[i] = { ...e, name: ev.target.value }; setExtras(n);
                      }} style={{ ...inputBase, flex: 1, minWidth: 0 }} />
                      <input type="number" value={e.pct} onChange={(ev) => {
                        const n = [...extras]; n[i] = { ...e, pct: ev.target.value }; setExtras(n);
                      }} style={{ ...inputBase, width: 62, fontFamily: mono }} />
                      <button onClick={() => setExtras(extras.filter((x) => x.id !== e.id))}
                        style={miniBtn}>−</button>
                    </div>
                  ))}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {["橄欖油", "糖", "蜂蜜", "奶油", "牛奶"].map((n) => (
                      <button key={n} onClick={() =>
                        setExtras([...extras, { id: Date.now() + Math.random(), name: n, pct: 5 }])
                      } style={ghostBtn}>＋ {n}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ ...box, marginTop: 16 }}>
                <Label>器材</Label>
                {gears.map((x, i) => (
                  <div key={x.id} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                    <button onClick={() => setGearId(x.id)} aria-label={`選擇 ${x.name}`} style={{
                      width: 16, height: 16, borderRadius: 8, flexShrink: 0, cursor: "pointer", padding: 0,
                      border: `1px solid ${gearId === x.id ? C.levain : C.rule}`,
                      background: gearId === x.id ? C.levain : "transparent",
                    }} />
                    <input value={x.name} onChange={(e) => {
                      const n = [...gears]; n[i] = { ...x, name: e.target.value }; setGears(n);
                    }} style={{ ...inputBase, flex: 1, minWidth: 0 }} />
                    <button onClick={() => setGears(gears.filter((y) => y.id !== x.id))}
                      disabled={gears.length === 1}
                      style={{ ...miniBtn, cursor: gears.length === 1 ? "default" : "pointer" }}>−</button>
                  </div>
                ))}
                <button onClick={() => setGears([...gears, { id: Date.now(), name: "新器材" }])}
                  style={ghostBtn}>＋ 加器材</button>

                <div style={{ marginTop: 18 }}><Label>烘烤參數</Label></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12 }}>
                  {[["預熱", "preheatTemp", "preheatMin"], ["前段", "t1", "m1"], ["後段", "t2", "m2"]].map(
                    ([label, tk, mk]) => (
                      <div key={label}>
                        <div style={{ fontSize: 11, color: C.ink60, marginBottom: 5 }}>{label}</div>
                        <div style={{ display: "flex", gap: 4, alignItems: "baseline" }}>
                          <input type="number" value={bake[tk]}
                            onChange={(e) => setBake({ ...bake, [tk]: e.target.value })}
                            style={{ ...inputBase, width: 56, fontFamily: mono }} />
                          <span style={{ fontFamily: mono, fontSize: 11, color: C.ink35 }}>°C</span>
                          <input type="number" value={bake[mk]}
                            onChange={(e) => setBake({ ...bake, [mk]: e.target.value })}
                            style={{ ...inputBase, width: 50, fontFamily: mono }} />
                          <span style={{ fontFamily: mono, fontSize: 11, color: C.ink35 }}>分</span>
                        </div>
                      </div>
                    ))}
                  {[["注水", "steamMl", "ml"], ["放涼", "coolMin", "分"]].map(([label, k, unit]) => (
                    <div key={k}>
                      <div style={{ fontSize: 11, color: C.ink60, marginBottom: 5 }}>{label}</div>
                      <div style={{ display: "flex", gap: 4, alignItems: "baseline" }}>
                        <input type="number" value={bake[k]}
                          onChange={(e) => setBake({ ...bake, [k]: e.target.value })}
                          style={{ ...inputBase, width: 56, fontFamily: mono }} />
                        <span style={{ fontFamily: mono, fontSize: 11, color: C.ink35 }}>{unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: C.ink35, marginTop: 10, lineHeight: 1.6 }}>
                  用鑄鐵鍋時把注水設為 0，鍋蓋會封住水氣。
                </div>
              </div>
            </div>

            <div>
              <div style={box}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <Label>秤這些</Label>
                  <span style={{ fontFamily: mono, fontSize: 12, color: C.ink35 }}>共 {g(cfg.total)} g</span>
                </div>

                {!r.valid && (
                  <div style={{
                    background: "#F6E4E0", border: `1px solid ${C.warn}`, borderRadius: 2,
                    padding: "9px 11px", marginBottom: 12, fontSize: 12, color: C.warn, lineHeight: 1.5,
                  }}>
                    酸種比例太高，它帶進來的水已超過設定的含水率。把酸種比例調低，或把含水率調高。
                  </div>
                )}

                <div style={{ display: "flex", height: 8, borderRadius: 2, overflow: "hidden", marginBottom: 14 }}>
                  {bar.map((b, i) => (
                    <div key={i} style={{ width: `${(b.w / barTotal) * 100}%`, background: b.c, opacity: b.o }} />
                  ))}
                </div>

                {r.flourRows.map((f, i) => (
                  <Row key={i} name={f.name} grams={f.grams} note={`${Math.round(f.pct)}%`} color={C.flour} />
                ))}
                <Row name="水" grams={r.waterToAdd} color={C.water} />
                <Row name="酸種" grams={r.levain} note={`${cfg.levainHyd}% 含水`} color={C.levain} />
                <Row name="麵粉" grams={r.levainFlour} indent />
                <Row name="水" grams={r.levainWater} indent />
                <Row name="鹽" grams={r.salt} color={C.salt} />
                {r.extraRows.map((e, i) => (
                  <Row key={i} name={e.name} grams={e.grams} note={`${e.pct}%`} color={C.extra} />
                ))}

                <div style={{
                  marginTop: 14, paddingTop: 12, borderTop: `1.5px solid ${C.ink}`,
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
                }}>
                  {[
                    ["總麵粉", g(r.flourTotal) + " g"],
                    ["總水量", g(r.waterTotal) + " g"],
                    ["實際含水率", (r.waterTotal / r.flourTotal * 100).toFixed(1) + " %"],
                    ["酸種佔麵粉", cfg.levainPct + " %"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 10, color: C.ink35, letterSpacing: "0.06em" }}>{k}</div>
                      <div style={{ fontFamily: mono, fontSize: 16, fontVariantNumeric: "tabular-nums" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={startCook} style={{ ...solidBtn, width: "100%", marginTop: 16, padding: 14, fontSize: 15 }}>
                開始製作
              </button>
              <div style={{ fontSize: 12, color: C.ink35, marginTop: 8, textAlign: "center" }}>
                {steps.length} 步 · 計時總長約 {fmtDur(totalMin)} · {gearName}
              </div>
            </div>
          </div>
        )}

        {/* ── 步驟 ── */}
        {tab === "steps" && (
          <div style={box}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <Label>製作步驟</Label>
              <span style={{ fontFamily: mono, fontSize: 12, color: C.ink35 }}>
                計時總長 {fmtDur(totalMin)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: C.ink35, marginBottom: 14, lineHeight: 1.6 }}>
              時間填 0 表示這一步看麵團狀態，不計時。預熱與烘烤兩步的溫度時間讀「烘烤參數」（在配方頁改），
              但每一步的備註都可以自己寫。
            </div>

            {steps.map((s, i) => (
              <div key={s.id} style={{
                display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start",
                paddingBottom: 8, borderBottom: `1px solid ${C.rule}`,
              }}>
                <span style={{
                  fontFamily: mono, fontSize: 11, color: C.ink35,
                  paddingTop: 8, width: 20, flexShrink: 0,
                }}>{String(i + 1).padStart(2, "0")}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input value={s.name} onChange={(e) => {
                    const n = [...steps]; n[i] = { ...s, name: e.target.value }; setSteps(n);
                  }} style={{ ...inputBase, width: "100%", marginBottom: 4, fontSize: 14 }} />
                  {s.link && autoLine(s, bake, gearName) && (
                    <div style={{
                      fontSize: 11, color: C.ink35, fontFamily: mono,
                      padding: "2px 0 4px", lineHeight: 1.5,
                    }}>
                      自動帶入：{autoLine(s, bake, gearName)}
                    </div>
                  )}
                  <input value={s.detail}
                    placeholder={s.link ? "自己的備註（會接在上面那句後面）" : "備註"}
                    onChange={(e) => {
                      const n = [...steps]; n[i] = { ...s, detail: e.target.value }; setSteps(n);
                    }}
                    style={{ ...inputBase, width: "100%", fontSize: 12, color: C.ink60 }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 3, alignItems: "baseline" }}>
                    <input type="number" value={s.link ? resolveMin(s, bake) : s.min}
                      disabled={!!s.link}
                      onChange={(e) => {
                        const n = [...steps]; n[i] = { ...s, min: e.target.value }; setSteps(n);
                      }}
                      style={{ ...inputBase, width: 56, fontFamily: mono, color: s.link ? C.ink35 : C.ink }} />
                    <span style={{ fontFamily: mono, fontSize: 11, color: C.ink35 }}>分</span>
                  </div>
                  <div style={{ display: "flex", gap: 3 }}>
                    <button onClick={() => {
                      if (i === 0) return;
                      const n = [...steps]; const t = n[i - 1]; n[i - 1] = n[i]; n[i] = t; setSteps(n);
                    }} style={{ ...miniBtn, width: 26, fontSize: 11 }}>↑</button>
                    <button onClick={() => {
                      if (i === steps.length - 1) return;
                      const n = [...steps]; const t = n[i + 1]; n[i + 1] = n[i]; n[i] = t; setSteps(n);
                    }} style={{ ...miniBtn, width: 26, fontSize: 11 }}>↓</button>
                    <button onClick={() => setSteps(steps.filter((x) => x.id !== s.id))}
                      style={{ ...miniBtn, width: 26 }}>−</button>
                  </div>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={() => setSteps([...steps, { id: Date.now(), name: "新步驟", detail: "", min: 30 }])}
                style={ghostBtn}>＋ 加步驟</button>
              <button onClick={() => setSteps(DEFAULT_STEPS)} style={{
                fontSize: 12, color: C.ink35, background: "transparent",
                border: "none", cursor: "pointer", fontFamily: sans,
              }}>回到預設流程</button>
            </div>
          </div>
        )}

        {/* ── 配方卡 ── */}
        {tab === "card" && (
          <div>
            {logs.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: C.ink60 }}>來源</span>
                <button onClick={() => setCardLogId(null)} style={{
                  fontSize: 12, padding: "5px 11px", borderRadius: 2, cursor: "pointer", fontFamily: sans,
                  background: !cardLogId ? C.ink : "transparent",
                  color: !cardLogId ? C.card : C.ink60,
                  border: `1px solid ${!cardLogId ? C.ink : C.rule}`,
                }}>目前配方</button>
                {logs.slice(0, 6).map((l) => (
                  <button key={l.id} onClick={() => setCardLogId(l.id)} style={{
                    fontSize: 12, padding: "5px 11px", borderRadius: 2, cursor: "pointer",
                    fontFamily: mono,
                    background: cardLogId === l.id ? C.ink : "transparent",
                    color: cardLogId === l.id ? C.card : C.ink60,
                    border: `1px solid ${cardLogId === l.id ? C.ink : C.rule}`,
                  }}>{l.date}</button>
                ))}
              </div>
            )}
            <CardTab card={card} onName={(v) => {
              if (activeLog) {
                setLogs(logs.map((l) => (l.id === activeLog.id ? { ...l, name: v } : l)));
              } else setRecipeName(v);
            }} />
          </div>
        )}

        {/* ── 紀錄 ── */}
        {tab === "log" && (
          <div>
            {draft && (
              <div style={{ ...box, marginBottom: 16, borderColor: C.levain }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>這次烤得如何</div>
                <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))" }}>
                  <div>
                    <input type="date" value={draft.date}
                      onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                      style={{ ...inputBase, fontFamily: mono, marginBottom: 10 }} />
                    <div style={{ fontFamily: mono, fontSize: 12, color: C.ink60, marginBottom: 10, lineHeight: 1.6 }}>
                      {draft.gearName}<br />
                      {draft.bake.preheatTemp}°C 預熱 {draft.bake.preheatMin}′ →
                      {" "}{draft.bake.t1}°C {draft.bake.m1}′ → {draft.bake.t2}°C {draft.bake.m2}′
                    </div>
                    <textarea placeholder="室溫、酸種狀態、手感、口感、下次想改什麼"
                      value={draft.note} rows={5}
                      onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                      style={{ ...inputBase, width: "100%", resize: "vertical" }} />
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <label style={{ ...ghostBtn, display: "inline-block" }}>
                        ＋ 加照片
                        <input type="file" accept="image/*" multiple
                          onChange={(e) => addPhotos(e.target.files)} style={{ display: "none" }} />
                      </label>
                      {busy && <span style={{ fontSize: 12, color: C.ink35 }}>{busy}</span>}
                    </div>
                    {draft.photos.length > 0 && (
                      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                        {draft.photos.map((p) => <Photo key={p} id={p} onRemove={dropPhoto} />)}
                      </div>
                    )}
                  </div>
                  <div>
                    {SCORE_KEYS.map(([k, label]) => (
                      <Stars key={k} label={label} value={draft.scores[k]}
                        onChange={(v) => setDraft({ ...draft, scores: { ...draft.scores, [k]: v } })} />
                    ))}
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button onClick={saveLog} style={{ ...solidBtn, flex: 1 }}>存起來</button>
                      <button onClick={() => setDraft(null)} style={{
                        padding: "10px 14px", background: "transparent", color: C.ink60,
                        border: `1px solid ${C.rule}`, borderRadius: 2,
                        fontSize: 13, cursor: "pointer", fontFamily: sans,
                      }}>取消</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!draft && (
              <button onClick={() => setDraft(newDraft(null))}
                style={{ ...ghostBtn, marginBottom: 14, padding: "8px 14px", fontSize: 13 }}>
                ＋ 手動新增一筆紀錄
              </button>
            )}

            {loading ? (
              <div style={{ fontSize: 13, color: C.ink35 }}>讀取中⋯</div>
            ) : logs.length === 0 ? (
              <div style={{
                border: `1px dashed ${C.rule}`, borderRadius: 3, padding: "22px 18px",
                fontSize: 13, color: C.ink35, lineHeight: 1.6,
              }}>
                還沒有紀錄。走完製作模式最後一步會自動開一筆，評分和照片存下來，
                之後就能對照哪次的參數做出哪種結果。
              </div>
            ) : (
              logs.map((l) => {
                const rr = compute(l.cfg);
                return (
                  <div key={l.id} style={{ ...box, marginBottom: 10, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: mono, fontSize: 13 }}>{l.date}</span>
                      {l.name && <span style={{ fontSize: 13, fontWeight: 600 }}>{l.name}</span>}
                      <span style={{ fontFamily: mono, fontSize: 12, color: C.ink60 }}>
                        {g(l.cfg.total)}g · 含水 {(rr.waterTotal / rr.flourTotal * 100).toFixed(0)}% · 酸種 {l.cfg.levainPct}%
                      </span>
                      <span style={{ flex: 1 }} />
                      <button onClick={() => { setCardLogId(l.id); setTab("card"); }} style={{
                        fontSize: 12, color: C.ink60, background: "transparent",
                        border: `1px solid ${C.rule}`, borderRadius: 2,
                        padding: "3px 9px", cursor: "pointer", fontFamily: sans,
                      }}>做成卡片</button>
                      <button onClick={() => loadCfg(l.cfg)} style={{
                        fontSize: 12, color: C.ink60, background: "transparent",
                        border: `1px solid ${C.rule}`, borderRadius: 2,
                        padding: "3px 9px", cursor: "pointer", fontFamily: sans,
                      }}>載入配方</button>
                      <button onClick={() => delLog(l)} style={{
                        fontSize: 12, color: C.ink35, background: "transparent",
                        border: "none", cursor: "pointer", fontFamily: sans,
                      }}>刪除</button>
                    </div>

                    {(l.gearName || l.bake) && (
                      <div style={{ fontFamily: mono, fontSize: 12, color: C.ink60, marginTop: 6, lineHeight: 1.6 }}>
                        {l.gearName}
                        {l.bake && <> · {l.bake.t1}°C {l.bake.m1}′ → {l.bake.t2}°C {l.bake.m2}′</>}
                      </div>
                    )}

                    <div style={{ marginTop: 9 }}><ScoreDots scores={l.scores} /></div>

                    {l.photos && l.photos.length > 0 && (
                      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                        {l.photos.map((p) => <Photo key={p} id={p} />)}
                      </div>
                    )}

                    {l.note && (
                      <div style={{
                        fontSize: 13, color: C.ink60, marginTop: 9,
                        lineHeight: 1.6, whiteSpace: "pre-wrap",
                      }}>{l.note}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
