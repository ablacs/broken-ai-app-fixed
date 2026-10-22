import Link from "next/link";

export default function Home() {
  return (
    <>
      <h1>Notely</h1>
      <p>Write up to 3 notes for free. Upgrade to Pro for unlimited notes.</p>
      <Link href="/login">Log in or create an account</Link>
    </>
  );
}
