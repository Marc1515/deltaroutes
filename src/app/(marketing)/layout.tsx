import { MobileNavbar } from "./MobileNavbar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MobileNavbar />
      {children}
    </>
  );
}
