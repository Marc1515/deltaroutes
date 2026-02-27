export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* aquí tu header/landing layout si quieres */}
      {children}
      {/* aquí tu footer */}
    </>
  );
}
