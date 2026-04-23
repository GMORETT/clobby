import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Clobby — the lobby for people waiting on agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          padding: "80px",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Dots row */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "48px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "999px",
              background: "#ef4444",
              boxShadow: "0 0 20px rgba(239,68,68,0.6)",
            }}
          />
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "999px",
              background: "#22c55e",
              boxShadow: "0 0 20px rgba(34,197,94,0.6)",
            }}
          />
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "999px",
              background: "#52525b",
            }}
          />
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "88px",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>The lobby for</span>
          <span>people waiting on agents.</span>
        </div>

        {/* Sub */}
        <div
          style={{
            fontSize: "32px",
            color: "#a1a1aa",
            marginTop: "32px",
          }}
        >
          Clobby &middot; clobby.vercel.app
        </div>
      </div>
    ),
    { ...size },
  );
}
