// Decorative animated abstract background blobs
export function Blobs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
      <div
        className="blob"
        style={{
          width: 480,
          height: 480,
          top: "-100px",
          left: "-120px",
          background: "oklch(0.7 0.2 280)",
        }}
      />
      <div
        className="blob"
        style={{
          width: 380,
          height: 380,
          bottom: "-100px",
          right: "-80px",
          background: "oklch(0.72 0.18 200)",
          animationDelay: "-6s",
        }}
      />
      <div
        className="blob"
        style={{
          width: 300,
          height: 300,
          top: "40%",
          right: "30%",
          background: "oklch(0.7 0.2 320)",
          opacity: 0.25,
          animationDelay: "-12s",
        }}
      />
    </div>
  );
}
