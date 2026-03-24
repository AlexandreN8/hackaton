import React, { useState, useEffect } from "react";

export default function AIReco({ pIt, results }) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const hasResults = results && results.length > 0;

  useEffect(() => {
    if (hasResults) {
      const fakeAiResponse = `Analyse thermique et financière terminée.\n\nPour une charge IT de ${pIt || 50} kW, les technologies traditionnelles à air (AC) atteignent leurs limites d'efficacité énergétique et physique.\n\n💡 Recommandation Cisco i-Cooling :\nNous recommandons une transition immédiate vers l'Immersion Cooling (IC) ou le DLC. Ces technologies permettent d'absorber la haute densité des racks IA tout en divisant l'énergie de refroidissement par 10. Le surcoût initial (CAPEX) sera rapidement amorti grâce aux économies d'énergie massives (OPEX) générées.`;

      setIsTyping(true);
      setDisplayedText("");

      let i = 0;
      const typingInterval = setInterval(() => {
        setDisplayedText(fakeAiResponse.slice(0, i));
        i++;
        if (i > fakeAiResponse.length) {
          clearInterval(typingInterval);
          setIsTyping(false);
        }
      }, 15);

      return () => clearInterval(typingInterval);
    }
  }, [hasResults, pIt]);

  if (!hasResults) return null;

  return (
    <div className="card fade-in" style={{ marginTop: "16px" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--text3)",
          textTransform: "uppercase",
          letterSpacing: ".08em",
          marginBottom: "12px",
        }}
      >
        Recommandation IA
      </div>

      <div
        style={{
          background: "var(--surface2)",
          borderRadius: "8px",
          padding: "16px",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "var(--cisco-light)",
            color: "var(--cisco)",
            padding: "4px 10px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 600,
            marginBottom: "12px",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: isTyping ? "spin 2s linear infinite" : "none" }}
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>

          {isTyping ? "Génération en cours..." : "Analyse IA terminée"}
        </div>

        <div
          style={{
            color: "var(--text2)",
            fontSize: "14px",
            whiteSpace: "pre-wrap",
            lineHeight: "1.6",
          }}
        >
          {displayedText}
          {isTyping && (
            <span
              style={{
                display: "inline-block",
                width: "4px",
                height: "14px",
                background: "var(--cisco)",
                marginLeft: "2px",
                verticalAlign: "middle",
                animation: "blink 1s infinite",
              }}
            ></span>
          )}
        </div>
      </div>
    </div>
  );
}
