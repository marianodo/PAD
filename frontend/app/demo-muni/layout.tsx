export default function DemoMuniLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="stylesheet" href="/demo-muni/bootstrap.min.css" />
        <link rel="stylesheet" href="/demo-muni/font-awesome.min.css" />
        <link rel="stylesheet" href="/demo-muni/Site.css" />
      </head>
      <body style={{ backgroundColor: "#f5f5f5" }}>{children}</body>
    </html>
  );
}
