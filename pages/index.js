// pages/index.js
export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        fontFamily: "sans-serif",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
      }}
    >
      <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>
        🎉 FAQ 포털 배포 성공!
      </h1>
      <p style={{ fontSize: "1.2rem" }}>페이지가 정상적으로 작동합니다.</p>
      <p style={{ fontSize: "0.9rem", marginTop: "2rem", opacity: 0.8 }}>
        Vercel 배포: ✅ 완료
      </p>
    </div>
  );
}
