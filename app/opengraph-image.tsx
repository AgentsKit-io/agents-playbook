import { ImageResponse } from "next/og";
import stats from "./stats.snapshot.json";

const C = stats.counts;

export const runtime = "edge";
export const alt = "Agents Playbook";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px",
          background:
            "radial-gradient(ellipse at top left, rgba(140,100,255,0.30), transparent 55%), radial-gradient(ellipse at bottom right, rgba(30,180,255,0.20), transparent 50%), #0b0a13",
          color: "white",
          fontFamily: "Inter, system-ui",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "26px",
            color: "rgba(255,255,255,0.7)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            marginBottom: "40px",
          }}
        >
          <span
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "9999px",
              background:
                "linear-gradient(135deg, oklch(0.72 0.18 295), oklch(0.68 0.18 240))",
            }}
          />
          Agents Playbook
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "78px",
            fontWeight: 700,
            lineHeight: 1.04,
            letterSpacing: "-0.02em",
            maxWidth: "1000px",
          }}
        >
          The gold-standard playbook for shipping production software with{" "}
          <span
            style={{
              background:
                "linear-gradient(135deg, oklch(0.85 0.18 295), oklch(0.80 0.18 240))",
              backgroundClip: "text",
              color: "transparent",
              marginLeft: "12px",
            }}
          >
            AI coding agents.
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: "32px",
            marginTop: "44px",
            fontSize: "24px",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          <span>{C.pillars} pillars</span>
          <span>·</span>
          <span>{C.patterns}+ patterns</span>
          <span>·</span>
          <span>{C.gateScripts} gate scripts</span>
        </div>
      </div>
    ),
    size,
  );
}
