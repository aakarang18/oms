import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="wrap" style={{ padding: '120px 24px', textAlign: 'center' }}>
      <h1 className="d h-xl forest">Wrong turn.</h1>
      <p className="lead muted">This page doesn’t exist — but the start line does.</p>
      <Link href="/" className="btn btn-primary" style={{ marginTop: 20 }}>Back to the homepage</Link>
    </main>
  );
}
