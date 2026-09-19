import { ImageResponse } from "next/og";

export function brandIcon(size: number) {
  const fontSize = Math.round(size * 0.46);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2f49d1",
          color: "#ffffff",
          fontSize,
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        M
      </div>
    ),
    { width: size, height: size },
  );
}
