import SuccessClient from "./SuccessClient";

export default function SuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id ?? null;
  return <SuccessClient sessionId={sessionId} />;
}
