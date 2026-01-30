export default function SuccessPage({
    searchParams,
  }: {
    searchParams: { session_id?: string };
  }) {
    return (
      <main style={{ padding: 24 }}>
        <h1>✅ Pago completado</h1>
        <p>Gracias. Tu pago se ha procesado correctamente.</p>
        {searchParams.session_id && (
          <p>
            <strong>session_id:</strong> {searchParams.session_id}
          </p>
        )}
        <p>Ya puedes cerrar esta ventana.</p>
      </main>
    );
  }
  