import { useState, useEffect, useRef, useCallback } from "react";

const COLORS = {
  pink: "#FF6B9D",
  pinkHot: "#FF4088",
  pinkLight: "#FFB3D0",
  pinkSoft: "#FFE0EC",
  pinkPale: "#FFF0F5",
  magenta: "#E8368F",
  berry: "#C7266A",
  lavender: "#D4A5FF",
  lavenderSoft: "#F0E0FF",
  lilac: "#B388FF",
  mint: "#7DDDB5",
  mintSoft: "#D4F5E6",
  peach: "#FFB088",
  peachSoft: "#FFE5D6",
  yellow: "#FFD966",
  coral: "#FF8A80",
  white: "#FFFFFF",
  cream: "#FFFAFC",
  offWhite: "#FFF5F8",
  grayLight: "#F5EAF0",
  grayMid: "#E0D4DC",
  textDark: "#3D1F33",
  textMid: "#7A5068",
  textMuted: "#B894A6",
  charcoal: "#2A1522",
  gold: "#FFB740",
  red: "#FF4D6A",
  green: "#55C98A",
};

const SWATCHES = [
  { name: "Pink", color: "#FF6B9D" },
  { name: "Lavender", color: "#B388FF" },
  { name: "Blue", color: "#64B5F6" },
  { name: "Mint", color: "#7DDDB5" },
  { name: "Peach", color: "#FFB088" },
  { name: "Red", color: "#FF4D6A" },
  { name: "Gold", color: "#FFB740" },
  { name: "Berry", color: "#C7266A" },
];

// ===== FLOATING BUBBLES BACKGROUND =====
function Bubbles({ count = 12, dark = false }) {
  const bubbles = useRef(Array.from({ length: count }, (_, i) => ({
    id: i,
    size: 12 + Math.random() * 40,
    left: Math.random() * 100,
    delay: Math.random() * 8,
    duration: 6 + Math.random() * 10,
    opacity: dark ? 0.06 + Math.random() * 0.08 : 0.1 + Math.random() * 0.15,
    color: dark
      ? [COLORS.pink, COLORS.lavender, COLORS.magenta][i % 3]
      : [COLORS.pink, COLORS.lavender, COLORS.peach, COLORS.mint, COLORS.yellow][i % 5],
  }))).current;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {bubbles.map(b => (
        <div key={b.id} style={{
          position: "absolute", bottom: -b.size,
          left: `${b.left}%`, width: b.size, height: b.size,
          borderRadius: "50%", background: b.color, opacity: b.opacity,
          animation: `bubbleFloat ${b.duration}s ${b.delay}s ease-in infinite`,
        }} />
      ))}
    </div>
  );
}

// ===== MANGA AVATAR =====
function MangaAvatar({ speaking, size = 120 }) {
  return (
    <div style={{
      width: size, height: size, position: "relative",
      animation: speaking ? "avatarBounce 0.6s ease-in-out infinite" : "avatarIdle 3s ease-in-out infinite",
    }}>
      <svg viewBox="0 0 200 200" width={size} height={size}>
        {/* Hair back */}
        <ellipse cx="100" cy="85" rx="72" ry="75" fill="#3D1F33" />
        <ellipse cx="100" cy="90" rx="68" ry="65" fill="#5A2D45" />
        {/* Face */}
        <ellipse cx="100" cy="100" rx="55" ry="58" fill="#FFE0D0" />
        {/* Blush */}
        <ellipse cx="68" cy="115" rx="12" ry="7" fill="#FFB3C1" opacity="0.6" />
        <ellipse cx="132" cy="115" rx="12" ry="7" fill="#FFB3C1" opacity="0.6" />
        {/* Eyes */}
        <ellipse cx="78" cy="100" rx="10" ry="12" fill="#3D1F33" />
        <ellipse cx="122" cy="100" rx="10" ry="12" fill="#3D1F33" />
        {/* Eye sparkles */}
        <circle cx="82" cy="96" r="4" fill="white" />
        <circle cx="126" cy="96" r="4" fill="white" />
        <circle cx="76" cy="102" r="2" fill="white" />
        <circle cx="120" cy="102" r="2" fill="white" />
        {/* Eyebrows */}
        <path d="M65 85 Q78 78 90 85" stroke="#3D1F33" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M110 85 Q122 78 135 85" stroke="#3D1F33" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Mouth */}
        {speaking ? (
          <ellipse cx="100" cy="128" rx="12" ry={10} fill="#FF6B9D" >
            <animate attributeName="ry" values="10;6;10" dur="0.4s" repeatCount="indefinite" />
          </ellipse>
        ) : (
          <path d="M88 125 Q100 138 112 125" stroke="#FF6B9D" strokeWidth="3" fill="none" strokeLinecap="round" />
        )}
        {speaking && <ellipse cx="100" cy="126" rx="6" ry="3" fill="#CC3366" opacity="0.5" />}
        {/* Hair bangs */}
        <path d="M35 75 Q50 40 80 50 Q70 70 60 80 Z" fill="#3D1F33" />
        <path d="M165 75 Q150 40 120 50 Q130 70 140 80 Z" fill="#3D1F33" />
        <path d="M55 55 Q75 25 100 35 Q90 55 80 65 Z" fill="#4A2540" />
        <path d="M145 55 Q125 25 100 35 Q110 55 120 65 Z" fill="#4A2540" />
        {/* Sparkle accessories */}
        <circle cx="48" cy="90" r="4" fill={COLORS.pink} opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="152" cy="90" r="3" fill={COLORS.lavender} opacity="0.7">
          <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2.5s" repeatCount="indefinite" />
        </circle>
        {/* Star hair clip */}
        <g transform="translate(145, 60) scale(0.5)">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill={COLORS.yellow} />
        </g>
      </svg>
      {/* Speech bubble effect when speaking */}
      {speaking && (
        <>
          <div style={{
            position: "absolute", top: -4, right: -2,
            width: 10, height: 10, borderRadius: "50%",
            background: COLORS.pinkSoft, border: `2px solid ${COLORS.pink}40`,
            animation: "popBubble 1.5s ease-out infinite",
          }} />
          <div style={{
            position: "absolute", top: 5, right: -12,
            width: 7, height: 7, borderRadius: "50%",
            background: COLORS.lavenderSoft, border: `2px solid ${COLORS.lavender}40`,
            animation: "popBubble 1.8s 0.3s ease-out infinite",
          }} />
        </>
      )}
    </div>
  );
}

// ===== AI STATUS ORB =====
function AiOrb({ state }) {
  const colorMap = {
    listening: COLORS.pink,
    thinking: COLORS.lavender,
    speaking: COLORS.magenta,
    idle: COLORS.grayMid,
  };
  const c = colorMap[state] || colorMap.idle;
  const labels = {
    listening: "Listening...",
    thinking: "Thinking...",
    speaking: "Speaking...",
    idle: "Connecting...",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            width: 4, height: state !== "idle" ? 8 + Math.sin(i * 1.2) * 10 : 4,
            borderRadius: 3, background: c,
            animation: state !== "idle" ? `barBounce 0.8s ${i * 0.1}s ease-in-out infinite alternate` : "none",
            transition: "height 0.3s",
          }} />
        ))}
      </div>
      <span style={{
        fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 600,
        color: "#ffffffcc", letterSpacing: 0.2,
      }}>{labels[state]}</span>
    </div>
  );
}

// ===== BUBBLE BUTTON =====
function BubbleButton({ children, onClick, disabled, variant = "primary", style: extraStyle = {} }) {
  const styles = {
    primary: {
      background: `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.magenta})`,
      color: COLORS.white,
      boxShadow: `0 6px 0 ${COLORS.berry}, 0 8px 20px ${COLORS.pink}40`,
    },
    secondary: {
      background: `linear-gradient(135deg, ${COLORS.lavender}, ${COLORS.lilac})`,
      color: COLORS.white,
      boxShadow: `0 5px 0 #8855CC, 0 7px 16px ${COLORS.lavender}40`,
    },
    dark: {
      background: `linear-gradient(135deg, ${COLORS.charcoal}, #4A2540)`,
      color: COLORS.white,
      boxShadow: `0 5px 0 #1A0A14, 0 7px 16px rgba(0,0,0,0.3)`,
    },
    ghost: {
      background: COLORS.white,
      color: COLORS.textMid,
      boxShadow: `0 4px 0 ${COLORS.grayMid}, 0 6px 12px rgba(0,0,0,0.06)`,
    },
    disabled: {
      background: COLORS.grayLight,
      color: COLORS.textMuted,
      boxShadow: `0 3px 0 ${COLORS.grayMid}`,
    },
  };
  const s = disabled ? styles.disabled : styles[variant];
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      width: "100%", padding: "16px 24px", borderRadius: 50,
      border: "none", cursor: disabled ? "default" : "pointer",
      fontFamily: "'Nunito', sans-serif", fontSize: 16, fontWeight: 800,
      letterSpacing: 0.5, transition: "all 0.15s",
      position: "relative", ...s, ...extraStyle,
    }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = "translateY(3px)"; }}
      onMouseUp={e => e.currentTarget.style.transform = "translateY(0)"}
      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
    >{children}</button>
  );
}

// ===== CONFETTI =====
function Confetti() {
  const particles = Array.from({ length: 35 }, (_, i) => ({
    id: i, left: Math.random() * 100,
    delay: Math.random() * 1.2, duration: 2 + Math.random() * 2,
    color: [COLORS.pink, COLORS.lavender, COLORS.yellow, COLORS.mint, COLORS.peach, COLORS.magenta][i % 6],
    size: 5 + Math.random() * 7, isCircle: Math.random() > 0.5,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 10 }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute", left: `${p.left}%`, top: -10,
          width: p.size, height: p.isCircle ? p.size : p.size * 1.4,
          backgroundColor: p.color, borderRadius: p.isCircle ? "50%" : 2,
          animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`, opacity: 0,
        }} />
      ))}
    </div>
  );
}

// ===== SHIMMER =====
function Shimmer({ width = "100%", height = 20, borderRadius = 16 }) {
  return (
    <div style={{
      width, height, borderRadius,
      background: `linear-gradient(90deg, ${COLORS.pinkPale} 25%, ${COLORS.pinkSoft} 50%, ${COLORS.pinkPale} 75%)`,
      backgroundSize: "200% 100%", animation: "shimmer 1.5s ease-in-out infinite",
    }} />
  );
}

// ===== ONBOARDING =====
function OnboardingScreen({ onComplete }) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

  const handleSubmit = () => {
    if (!name.trim()) { setError("Tell me your name! 💫"); return; }
    if (!selectedColor) { setError("Pick a color you love! 🎨"); return; }
    setError(""); setLoading(true);
    setTimeout(() => { setLoading(false); onComplete(name.trim(), selectedColor); }, 1200);
  };

  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: `linear-gradient(170deg, ${COLORS.cream} 0%, ${COLORS.pinkPale} 35%, ${COLORS.lavenderSoft} 70%, ${COLORS.pinkSoft} 100%)`,
      position: "relative", overflow: "hidden",
    }}>
      <Bubbles count={10} />
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "40px 28px 32px", position: "relative", zIndex: 1,
        opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)",
        transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 8, textAlign: "center" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 22,
            background: `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.magenta})`,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 6px 0 ${COLORS.berry}, 0 10px 30px ${COLORS.pink}40`,
            marginBottom: 18,
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="white" />
            </svg>
          </div>
          <h1 style={{
            fontFamily: "'Baloo 2', cursive", fontSize: 34, fontWeight: 800,
            color: COLORS.textDark, margin: 0, lineHeight: 1.1,
          }}>LiveStylist</h1>
          <p style={{
            fontFamily: "'Nunito', sans-serif", fontSize: 15, fontWeight: 600,
            color: COLORS.textMid, margin: "4px 0 0",
          }}>Your AI Style Bestie ✨</p>
        </div>

        {/* Form */}
        <div style={{ marginTop: 32 }}>
          <label style={{
            fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700,
            color: COLORS.textMid, display: "block", marginBottom: 8,
          }}>What's your name?</label>
          <input type="text" value={name} maxLength={50} placeholder="e.g. Sophia"
            onChange={e => { setName(e.target.value.replace(/[^a-zA-Z\s]/g, "")); setError(""); }}
            style={{
              width: "100%", padding: "14px 18px", borderRadius: 50,
              border: `2px solid ${error && !name ? COLORS.red + "60" : COLORS.pinkLight}`,
              background: COLORS.white, fontFamily: "'Nunito', sans-serif",
              fontSize: 16, fontWeight: 600, color: COLORS.textDark, outline: "none",
              transition: "border-color 0.2s", boxSizing: "border-box",
              boxShadow: `0 3px 0 ${COLORS.grayLight}`,
            }}
            onFocus={e => e.target.style.borderColor = COLORS.pink}
            onBlur={e => e.target.style.borderColor = COLORS.pinkLight}
          />

          <label style={{
            fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700,
            color: COLORS.textMid, display: "block", marginTop: 22, marginBottom: 10,
          }}>Fave color? 🎨</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {SWATCHES.map(s => (
              <button key={s.name} onClick={() => { setSelectedColor(s.name); setError(""); }}
                style={{
                  width: 44, height: 44, borderRadius: 50, border: "none",
                  background: s.color, cursor: "pointer", position: "relative",
                  outline: selectedColor === s.name ? `3px solid ${COLORS.pink}` : "3px solid transparent",
                  outlineOffset: 3,
                  boxShadow: selectedColor === s.name
                    ? `0 4px 0 ${s.color}88, 0 6px 16px ${s.color}44`
                    : `0 3px 0 rgba(0,0,0,0.1)`,
                  transition: "all 0.2s",
                  transform: selectedColor === s.name ? "scale(1.12) translateY(-2px)" : "scale(1)",
                }}>
                {selectedColor === s.name && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
                    <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {error && (
            <p style={{
              fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 600,
              color: COLORS.red, margin: "14px 0 0", textAlign: "center",
            }}>{error}</p>
          )}
        </div>

        <div style={{ marginTop: 32 }}>
          <BubbleButton onClick={handleSubmit} disabled={loading}>
            {loading ? "Setting up... 🪄" : "Let's Go! 🚀"}
          </BubbleButton>
        </div>
      </div>
    </div>
  );
}

// ===== HOME SCREEN =====
function HomeScreen({ name, onStartSession, onOpenProfile }) {
  const [mounted, setMounted] = useState(false);
  const [sessionsRemaining, setSessionsRemaining] = useState(1);
  const [isPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
    setTimeout(() => setLoading(false), 1400);
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Hey there" : "Good evening";

  const handleStart = () => {
    if (sessionsRemaining > 0) { setSessionsRemaining(s => s - 1); onStartSession(); }
  };

  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: `linear-gradient(170deg, ${COLORS.cream} 0%, ${COLORS.pinkPale} 60%, ${COLORS.offWhite} 100%)`,
      position: "relative", overflow: "hidden",
    }}>
      <Bubbles count={8} />

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 22px 0", zIndex: 1,
        opacity: mounted ? 1 : 0, transition: "opacity 0.6s 0.1s",
      }}>
        <div style={{
          background: isPremium ? `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.peach})` : COLORS.white,
          padding: "5px 14px", borderRadius: 50,
          boxShadow: `0 2px 0 ${COLORS.grayMid}`,
          border: `2px solid ${isPremium ? COLORS.gold : COLORS.pinkLight}`,
        }}>
          <span style={{
            fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 800,
            color: isPremium ? COLORS.white : COLORS.textMid,
          }}>{isPremium ? "⭐ Premium" : "Free"}</span>
        </div>
        <button onClick={onOpenProfile} style={{
          width: 42, height: 42, borderRadius: 50,
          background: COLORS.white, border: `2px solid ${COLORS.pinkLight}`,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 3px 0 ${COLORS.grayLight}`,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke={COLORS.pink} strokeWidth="2.5" />
            <path d="M4 21C4 17.134 7.582 14 12 14C16.418 14 20 17.134 20 21" stroke={COLORS.pink} strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", padding: "24px 22px",
        position: "relative", zIndex: 1,
        opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(16px)",
        transition: "all 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.2s",
      }}>
        {loading ? (
          <div style={{ marginBottom: 28 }}>
            <Shimmer width={200} height={32} /><div style={{ height: 8 }} /><Shimmer width={160} height={18} />
          </div>
        ) : (
          <div style={{ marginBottom: 28 }}>
            <h1 style={{
              fontFamily: "'Baloo 2', cursive", fontSize: 30, fontWeight: 800,
              color: COLORS.textDark, margin: 0, lineHeight: 1.15,
            }}>{greeting},<br />{name}! 💖</h1>
            <p style={{
              fontFamily: "'Nunito', sans-serif", fontSize: 15, fontWeight: 600,
              color: COLORS.textMid, margin: "6px 0 0",
            }}>Ready for your style sesh?</p>
          </div>
        )}

        {/* Session Card */}
        <div style={{
          background: COLORS.white, borderRadius: 28, padding: "24px 22px",
          boxShadow: `0 4px 0 ${COLORS.pinkSoft}, 0 8px 24px ${COLORS.pink}15`,
          border: `2px solid ${COLORS.pinkLight}40`,
        }}>
          {loading ? (
            <><Shimmer width="60%" height={18} /><div style={{ height: 12 }} /><Shimmer width="40%" height={14} /><div style={{ height: 22 }} /><Shimmer height={54} borderRadius={50} /></>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 16,
                  background: sessionsRemaining > 0
                    ? `linear-gradient(135deg, ${COLORS.pinkSoft}, ${COLORS.lavenderSoft})`
                    : COLORS.grayLight,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 2px 0 ${COLORS.grayLight}`,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M15 10L19.553 7.724C20.278 7.362 21 7.868 21 8.618V15.382C21 16.132 20.278 16.638 19.553 16.276L15 14M5 18H13C14.105 18 15 17.105 15 16V8C15 6.895 14.105 6 13 6H5C3.895 6 3 6.895 3 8V16C3 17.105 3.895 18 5 18Z"
                      stroke={sessionsRemaining > 0 ? COLORS.pink : COLORS.textMuted}
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p style={{
                    fontFamily: "'Nunito', sans-serif", fontSize: 16, fontWeight: 800,
                    color: COLORS.textDark, margin: 0,
                  }}>Live Style Session</p>
                  <p style={{
                    fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 600,
                    color: COLORS.textMuted, margin: "2px 0 0",
                  }}>5 min • Camera + Voice</p>
                </div>
              </div>

              <div style={{
                margin: "16px 0", padding: "10px 16px", borderRadius: 50,
                background: sessionsRemaining > 0 ? `${COLORS.green}12` : `${COLORS.gold}15`,
                border: `1.5px solid ${sessionsRemaining > 0 ? COLORS.green + "30" : COLORS.gold + "30"}`,
              }}>
                <p style={{
                  fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700,
                  color: sessionsRemaining > 0 ? COLORS.green : COLORS.gold,
                  margin: 0, textAlign: "center",
                }}>
                  {sessionsRemaining > 0
                    ? `${sessionsRemaining} of ${isPremium ? 5 : 1} session${sessionsRemaining !== 1 ? "s" : ""} left ✨`
                    : "All sessions used today 😴"}
                </p>
              </div>

              <BubbleButton onClick={handleStart} disabled={sessionsRemaining <= 0}>
                {sessionsRemaining > 0 ? "Start Session! 💫" : "Come back tomorrow"}
              </BubbleButton>
            </>
          )}
        </div>

        {/* Upgrade Banner */}
        {!isPremium && !loading && (
          <div style={{
            marginTop: 16,
            background: `linear-gradient(135deg, ${COLORS.textDark}, #5A2D45)`,
            borderRadius: 50, padding: "14px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer",
            boxShadow: `0 4px 0 #1A0A14, 0 8px 16px rgba(0,0,0,0.15)`,
          }}>
            <div>
              <p style={{
                fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 800,
                color: COLORS.white, margin: 0,
              }}>Go Premium ⭐</p>
              <p style={{
                fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 600,
                color: "#ffffff66", margin: "1px 0 0",
              }}>5 sessions per day</p>
            </div>
            <div style={{
              padding: "7px 16px", borderRadius: 50,
              background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.peach})`,
              boxShadow: `0 2px 0 #CC8800`,
            }}>
              <span style={{
                fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800, color: COLORS.white,
              }}>Upgrade</span>
            </div>
          </div>
        )}

        {/* Tip */}
        {!loading && (
          <div style={{
            marginTop: 16, padding: "14px 18px", borderRadius: 20,
            background: COLORS.white, border: `2px solid ${COLORS.pinkLight}30`,
            boxShadow: `0 2px 0 ${COLORS.grayLight}`,
          }}>
            <p style={{
              fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700,
              color: COLORS.textMid, margin: 0, lineHeight: 1.5,
            }}>💡 Good lighting = better advice! Sit near a window for the best results.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== LIVE SESSION =====
function LiveSessionScreen({ name, onEnd }) {
  const [timeLeft, setTimeLeft] = useState(300);
  const [aiState, setAiState] = useState("idle");
  const [muted, setMuted] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 300); }, []);

  useEffect(() => {
    const states = ["idle", "listening", "thinking", "speaking", "listening", "speaking", "thinking", "speaking", "listening"];
    let idx = 0;
    const interval = setInterval(() => { idx = (idx + 1) % states.length; setAiState(states[idx]); }, 2800);
    setTimeout(() => setAiState("listening"), 1500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(timer); onEnd("time"); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(timer);
  }, [onEnd]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timerColor = timeLeft <= 30 ? COLORS.red : timeLeft <= 60 ? COLORS.gold : "#ffffffdd";
  const isSpeaking = aiState === "speaking";

  return (
    <div style={{
      height: "100%", background: COLORS.charcoal, position: "relative", overflow: "hidden",
    }}>
      {/* Dark background with camera sim */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at 50% 60%, #3D2035 0%, #1A1218 70%)`,
        opacity: mounted ? 1 : 0, transition: "opacity 1s",
      }} />

      <Bubbles count={8} dark />

      {/* Face guide */}
      <div style={{
        position: "absolute", top: "12%", left: "50%", transform: "translateX(-50%)",
        width: 180, height: 230, borderRadius: "50%",
        border: `1.5px dashed ${mounted ? "#ffffff18" : "transparent"}`,
        transition: "border-color 1.5s 0.5s",
      }} />

      {/* Camera placeholder */}
      <div style={{
        position: "absolute", top: "17%", left: "50%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.2,
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <path d="M15 10L19.553 7.724C20.278 7.362 21 7.868 21 8.618V15.382C21 16.132 20.278 16.638 19.553 16.276L15 14M5 18H13C14.105 18 15 17.105 15 16V8C15 6.895 14.105 6 13 6H5C3.895 6 3 6.895 3 8V16C3 17.105 3.895 18 5 18Z"
            stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 11, color: "#fff", fontWeight: 600 }}>Camera Feed</span>
      </div>

      {/* Top Bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, padding: "12px 18px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "linear-gradient(180deg, rgba(26,18,24,0.85) 0%, transparent 100%)",
        zIndex: 5, opacity: mounted ? 1 : 0, transition: "opacity 0.6s 0.3s",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(0,0,0,0.4)", borderRadius: 50, padding: "6px 14px",
          backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: COLORS.red,
            animation: "orbPulse 1.5s ease-in-out infinite",
          }} />
          <span style={{
            fontFamily: "'Nunito', sans-serif", fontSize: 17, fontWeight: 800,
            color: timerColor, letterSpacing: 1, transition: "color 0.5s",
            animation: timeLeft <= 30 ? "timerPulse 1s ease-in-out infinite" : "none",
          }}>{mins}:{secs.toString().padStart(2, "0")}</span>
        </div>
        <button onClick={() => setShowEndConfirm(true)} style={{
          padding: "7px 20px", borderRadius: 50,
          background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.15)",
          color: "#ffffffcc", fontFamily: "'Nunito', sans-serif",
          fontSize: 13, fontWeight: 700, cursor: "pointer", backdropFilter: "blur(8px)",
        }}>End</button>
      </div>

      {/* Avatar Area — bottom center */}
      <div style={{
        position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        zIndex: 5, opacity: mounted ? 1 : 0, transition: "opacity 0.8s 0.6s",
      }}>
        <MangaAvatar speaking={isSpeaking} size={110} />
        <div style={{
          background: "rgba(0,0,0,0.45)", borderRadius: 50, padding: "6px 16px",
          backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <span style={{
            fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700,
            color: COLORS.pinkLight,
          }}>Stylist AI</span>
        </div>
      </div>

      {/* Bottom UI */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 22px 26px",
        background: "linear-gradient(0deg, rgba(26,18,24,0.9) 0%, transparent 100%)",
        zIndex: 5, opacity: mounted ? 1 : 0, transition: "opacity 0.6s 0.5s",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <AiOrb state={aiState} />
          <button onClick={() => setMuted(!muted)} style={{
            width: 46, height: 46, borderRadius: 50,
            background: muted ? `${COLORS.red}25` : "rgba(255,255,255,0.08)",
            border: muted ? `2px solid ${COLORS.red}50` : "2px solid rgba(255,255,255,0.12)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)", transition: "all 0.2s",
          }}>
            {muted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke={COLORS.red} strokeWidth="2" strokeLinecap="round" />
                <line x1="23" y1="9" x2="17" y2="15" stroke={COLORS.red} strokeWidth="2" strokeLinecap="round" />
                <line x1="17" y1="9" x2="23" y2="15" stroke={COLORS.red} strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 1C10.343 1 9 2.343 9 4V12C9 13.657 10.343 15 12 15C13.657 15 15 13.657 15 12V4C15 2.343 13.657 1 12 1Z" stroke="#ffffffbb" strokeWidth="2" />
                <path d="M19 10V12C19 15.866 15.866 19 12 19C8.134 19 5 15.866 5 12V10" stroke="#ffffffbb" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="19" x2="12" y2="23" stroke="#ffffffbb" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* End Confirm */}
      {showEndConfirm && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 20, backdropFilter: "blur(4px)",
        }}>
          <div style={{
            background: COLORS.white, borderRadius: 28, padding: "28px 24px",
            width: "82%", maxWidth: 300, textAlign: "center",
            boxShadow: `0 6px 0 ${COLORS.grayMid}`,
          }}>
            <p style={{
              fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800,
              color: COLORS.textDark, margin: "0 0 4px",
            }}>End session?</p>
            <p style={{
              fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600,
              color: COLORS.textMid, margin: "0 0 20px",
            }}>You still have {mins}:{secs.toString().padStart(2, "0")} left</p>
            <div style={{ display: "flex", gap: 10 }}>
              <BubbleButton variant="ghost" onClick={() => setShowEndConfirm(false)}
                style={{ boxShadow: `0 3px 0 ${COLORS.grayMid}` }}>Nope!</BubbleButton>
              <BubbleButton onClick={() => onEnd("manual")}>End it</BubbleButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== SESSION SUMMARY =====
function SessionSummaryScreen({ name, duration, reason, sessionsLeft, onHome }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 200); }, []);

  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  const reasonText = reason === "time" ? "Time's up! ⏰" : reason === "manual" ? "You ended it 👋" : "Connection lost 📡";

  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: `linear-gradient(170deg, ${COLORS.cream} 0%, ${COLORS.pinkPale} 50%, ${COLORS.lavenderSoft} 100%)`,
      position: "relative", overflow: "hidden",
    }}>
      <Confetti /><Bubbles count={6} />
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "40px 28px", position: "relative", zIndex: 1,
        opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(24px)",
        transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
      }}>
        {/* Big emoji/icon */}
        <div style={{
          width: 80, height: 80, borderRadius: 50,
          background: `linear-gradient(135deg, ${COLORS.pinkSoft}, ${COLORS.lavenderSoft})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 20, boxShadow: `0 4px 0 ${COLORS.pinkLight}`,
        }}>
          <span style={{ fontSize: 38 }}>🎉</span>
        </div>

        <h1 style={{
          fontFamily: "'Baloo 2', cursive", fontSize: 28, fontWeight: 800,
          color: COLORS.textDark, margin: 0, textAlign: "center", lineHeight: 1.15,
        }}>Great sesh,<br />{name}!</h1>
        <p style={{
          fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600,
          color: COLORS.textMid, margin: "10px 0 0",
        }}>{reasonText}</p>

        {/* Stats */}
        <div style={{
          display: "flex", gap: 0, marginTop: 28,
          background: COLORS.white, borderRadius: 50, overflow: "hidden",
          boxShadow: `0 4px 0 ${COLORS.pinkSoft}, 0 6px 16px ${COLORS.pink}10`,
          border: `2px solid ${COLORS.pinkLight}30`,
        }}>
          <div style={{ textAlign: "center", padding: "16px 28px" }}>
            <p style={{
              fontFamily: "'Baloo 2', cursive", fontSize: 24, fontWeight: 800,
              color: COLORS.textDark, margin: 0,
            }}>{mins}:{secs.toString().padStart(2, "0")}</p>
            <p style={{
              fontFamily: "'Nunito', sans-serif", fontSize: 10, fontWeight: 700,
              color: COLORS.textMuted, margin: "1px 0 0", textTransform: "uppercase", letterSpacing: 0.8,
            }}>Duration</p>
          </div>
          <div style={{ width: 2, background: COLORS.pinkSoft }} />
          <div style={{ textAlign: "center", padding: "16px 28px" }}>
            <p style={{
              fontFamily: "'Baloo 2', cursive", fontSize: 24, fontWeight: 800,
              color: COLORS.textDark, margin: 0,
            }}>{sessionsLeft}</p>
            <p style={{
              fontFamily: "'Nunito', sans-serif", fontSize: 10, fontWeight: 700,
              color: COLORS.textMuted, margin: "1px 0 0", textTransform: "uppercase", letterSpacing: 0.8,
            }}>Left today</p>
          </div>
        </div>

        <div style={{ width: "100%", marginTop: 32 }}>
          <BubbleButton onClick={onHome}>Back to Home 🏠</BubbleButton>
          {sessionsLeft <= 0 && (
            <div style={{ marginTop: 12 }}>
              <BubbleButton variant="dark">⭐ Go Premium — 5x sessions</BubbleButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== PROFILE SHEET =====
function ProfileSheet({ name, color, onSave, onClose }) {
  const [editName, setEditName] = useState(name);
  const [editColor, setEditColor] = useState(color);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} />
      <div style={{
        background: COLORS.white, borderRadius: "28px 28px 0 0", padding: "18px 24px 30px",
        animation: "slideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
      }}>
        <div style={{
          width: 40, height: 5, borderRadius: 10, background: COLORS.pinkLight, margin: "0 auto 18px",
        }} />
        <h2 style={{
          fontFamily: "'Baloo 2', cursive", fontSize: 24, fontWeight: 800,
          color: COLORS.textDark, margin: "0 0 18px",
        }}>Edit Profile ✏️</h2>

        <label style={{
          fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700,
          color: COLORS.textMid, display: "block", marginBottom: 8,
        }}>Name</label>
        <input type="text" value={editName}
          onChange={e => setEditName(e.target.value.replace(/[^a-zA-Z\s]/g, ""))}
          style={{
            width: "100%", padding: "14px 18px", borderRadius: 50,
            border: `2px solid ${COLORS.pinkLight}`, background: COLORS.pinkPale,
            fontFamily: "'Nunito', sans-serif", fontSize: 16, fontWeight: 600,
            color: COLORS.textDark, outline: "none", boxSizing: "border-box",
            boxShadow: `0 2px 0 ${COLORS.grayLight}`,
          }}
        />

        <label style={{
          fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700,
          color: COLORS.textMid, display: "block", marginTop: 18, marginBottom: 10,
        }}>Fave color</label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {SWATCHES.map(s => (
            <button key={s.name} onClick={() => setEditColor(s.name)} style={{
              width: 40, height: 40, borderRadius: 50, border: "none",
              background: s.color, cursor: "pointer", position: "relative",
              outline: editColor === s.name ? `3px solid ${COLORS.pink}` : "3px solid transparent",
              outlineOffset: 3, transition: "all 0.2s",
              transform: editColor === s.name ? "scale(1.1)" : "scale(1)",
              boxShadow: `0 2px 0 rgba(0,0,0,0.12)`,
            }}>
              {editColor === s.name && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
                  <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 18, padding: "12px 0", borderTop: `2px solid ${COLORS.pinkPale}`,
        }}>
          <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 600, color: COLORS.textMid }}>Subscription</span>
          <span style={{
            fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800,
            color: COLORS.textMuted, background: COLORS.pinkPale,
            padding: "5px 14px", borderRadius: 50,
          }}>Free</span>
        </div>

        <div style={{ marginTop: 16 }}>
          <BubbleButton onClick={() => onSave(editName, editColor)}>Save Changes 💾</BubbleButton>
        </div>
      </div>
    </div>
  );
}

// ===== MAIN APP =====
export default function LiveStylistApp() {
  const [screen, setScreen] = useState("onboarding");
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [sessionReason, setSessionReason] = useState("");
  const sessionStartRef = useRef(null);

  const handleOnboardingComplete = useCallback((n, c) => { setName(n); setColor(c); setScreen("home"); }, []);
  const handleStartSession = useCallback(() => { sessionStartRef.current = Date.now(); setScreen("session"); }, []);
  const handleEndSession = useCallback((reason) => {
    const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
    setSessionDuration(Math.min(elapsed, 300));
    setSessionReason(reason); setScreen("summary");
  }, []);
  const handleBackToHome = useCallback(() => setScreen("home"), []);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh",
      background: `linear-gradient(135deg, ${COLORS.pinkPale}, ${COLORS.lavenderSoft})`,
      fontFamily: "'Nunito', sans-serif", padding: "20px", gap: 16,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Nunito:wght@400;500;600;700;800&display=swap');
        * { -webkit-font-smoothing: antialiased; }
        @keyframes orbPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.8; }
        }
        @keyframes timerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(650px) rotate(720deg); opacity: 0; }
        }
        @keyframes slideUp {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
        @keyframes bubbleFloat {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-700px) scale(0.3); opacity: 0; }
        }
        @keyframes avatarBounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-6px) scale(1.03); }
        }
        @keyframes avatarIdle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes popBubble {
          0% { transform: scale(0); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.8; }
          100% { transform: scale(0); opacity: 0; }
        }
        @keyframes barBounce {
          0% { height: 4px; }
          100% { height: 18px; }
        }
      `}</style>

      {/* Phone Frame */}
      <div style={{
        width: 375, height: 812, borderRadius: 48, overflow: "hidden",
        background: COLORS.white,
        boxShadow: `0 25px 80px rgba(60,30,50,0.2), 0 4px 12px rgba(60,30,50,0.08)`,
        position: "relative",
        border: `7px solid ${COLORS.charcoal}`,
      }}>
        {/* Status Bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 48, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px",
          color: screen === "session" ? "#ffffffcc" : COLORS.textDark,
        }}>
          <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 800 }}>9:41</span>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <rect x="0" y="6" width="3" height="6" rx="1.5" fill="currentColor" opacity="0.4" />
              <rect x="4.5" y="4" width="3" height="8" rx="1.5" fill="currentColor" opacity="0.6" />
              <rect x="9" y="2" width="3" height="10" rx="1.5" fill="currentColor" opacity="0.8" />
              <rect x="13.5" y="0" width="3" height="12" rx="1.5" fill="currentColor" />
            </svg>
            <svg width="22" height="12" viewBox="0 0 22 12" fill="none">
              <rect x="0.5" y="0.5" width="19" height="11" rx="2.5" stroke="currentColor" opacity="0.4" />
              <rect x="20" y="3.5" width="2" height="5" rx="1" fill="currentColor" opacity="0.4" />
              <rect x="2" y="2" width="14" height="8" rx="1.5" fill="currentColor" />
            </svg>
          </div>
        </div>

        {/* Notch */}
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 155, height: 34, borderRadius: "0 0 22px 22px",
          background: COLORS.charcoal, zIndex: 51,
        }}>
          <div style={{
            position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
            width: 10, height: 10, borderRadius: "50%", background: "#1A1218",
            boxShadow: "inset 0 0 0 2px #333",
          }} />
        </div>

        {/* Screens */}
        <div style={{ position: "absolute", inset: 0, paddingTop: 48 }}>
          {screen === "onboarding" && <OnboardingScreen onComplete={handleOnboardingComplete} />}
          {screen === "home" && (
            <div style={{ height: "100%", position: "relative" }}>
              <HomeScreen name={name} onStartSession={handleStartSession} onOpenProfile={() => setShowProfile(true)} />
              {showProfile && (
                <ProfileSheet name={name} color={color}
                  onSave={(n, c) => { setName(n); setColor(c); setShowProfile(false); }}
                  onClose={() => setShowProfile(false)} />
              )}
            </div>
          )}
          {screen === "session" && <LiveSessionScreen name={name} onEnd={handleEndSession} />}
          {screen === "summary" && (
            <SessionSummaryScreen name={name} duration={sessionDuration}
              reason={sessionReason} sessionsLeft={0} onHome={handleBackToHome} />
          )}
        </div>

        {/* Home Indicator */}
        <div style={{
          position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
          width: 134, height: 5, borderRadius: 10,
          background: screen === "session" ? "rgba(255,255,255,0.2)" : COLORS.textDark + "18",
          zIndex: 50,
        }} />
      </div>

      {/* Nav */}
      <div style={{
        background: COLORS.charcoal, padding: "8px 18px", borderRadius: 50,
        display: "flex", gap: 14, alignItems: "center",
        boxShadow: `0 4px 0 #0A0508`,
      }}>
        {["onboarding", "home", "session", "summary"].map(s => (
          <button key={s} onClick={() => setScreen(s)} style={{
            background: screen === s ? `${COLORS.pink}25` : "none",
            border: "none", cursor: "pointer",
            fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700,
            color: screen === s ? COLORS.pink : "#ffffff55",
            padding: "5px 10px", borderRadius: 50,
            transition: "all 0.2s", textTransform: "capitalize",
          }}>{s}</button>
        ))}
      </div>
    </div>
  );
}
