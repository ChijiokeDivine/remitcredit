"use client";

import Link from "next/link";
import { CodeBlock } from "@/components/api-docs/CodeBlock";
import { useDocsAuth } from "@/components/api-docs/DocsAuthContext";
import { Button } from "@/components/ui/Button";

export default function AuthenticationGuidePage() {
  const auth = useDocsAuth();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Guide</p>
        <h1 className="font-[family-name:var(--font-serif)] text-3xl text-fg">Authentication</h1>
        <p className="text-[15px] leading-relaxed text-fg-secondary">
          The public API uses SIWE-style wallet authentication only. There are no API keys, passwords,
          or OAuth providers. You prove control of an address by signing a server-issued message;
          the private key never leaves the wallet.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg">Flow</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-fg-secondary">
          <li>
            <Link href="/docs/api/auth/challenge" className="text-accent underline">
              POST /auth/challenge
            </Link>{" "}
            with <code className="text-fg">{"{ \"address\": \"0x…\" }"}</code> — server stores a
            one-time nonce in Redis (10 minutes) and returns an EIP-4361 <code className="text-fg">message</code>.
          </li>
          <li>
            Sign <code className="text-fg">message</code> with the wallet (
            <code className="text-fg">personal_sign</code> / wagmi <code className="text-fg">signMessage</code>
            ).
          </li>
          <li>
            <Link href="/docs/api/auth/verify" className="text-accent underline">
              POST /auth/verify
            </Link>{" "}
            with message + signature. Server verifies signature, domain, URI, chain ID, consumes the
            nonce, and returns a Bearer <code className="text-fg">token</code> (24h in Redis).
          </li>
          <li>
            Call protected routes with{" "}
            <code className="text-fg">Authorization: Bearer &lt;token&gt;</code>.
          </li>
          <li>
            Optional:{" "}
            <Link href="/docs/api/auth/session-revoke" className="text-accent underline">
              DELETE /auth/session
            </Link>{" "}
            to revoke.
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg">Try from these docs</h2>
        <div className="flex flex-wrap gap-2">
          {!auth.isConnected ? (
            <Button size="sm" onClick={auth.connectWallet}>
              Connect wallet
            </Button>
          ) : !auth.sessionToken ? (
            <Button size="sm" loading={auth.isAuthenticating} onClick={() => auth.signInWithSiwe()}>
              Sign in with SIWE
            </Button>
          ) : (
            <p className="text-sm text-fg-secondary">
              Signed in as <span className="font-mono text-fg">{auth.sessionAddress}</span>.{" "}
              <button type="button" className="text-accent underline" onClick={auth.clearSession}>
                Clear session
              </button>
            </p>
          )}
        </div>
        {auth.authError && <p className="text-sm text-danger-fg">{auth.authError}</p>}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">Example (TypeScript)</h2>
        <CodeBlock
          language="typescript"
          code={`// 1. Challenge
const ch = await fetch("/api/v1/auth/challenge", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ address }),
}).then((r) => r.json());

// 2. Sign with wallet (wagmi / ethers / window.ethereum)
const signature = await signMessageAsync({ message: ch.message });

// 3. Verify
const session = await fetch("/api/v1/auth/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: ch.message, signature }),
}).then((r) => r.json());

// 4. Use token
const me = await fetch("/api/v1/wallets/me", {
  headers: { Authorization: \`Bearer \${session.token}\` },
}).then((r) => r.json());`}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">Security properties</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-fg-secondary">
          <li>Nonce is single-use (deleted on successful verify).</li>
          <li>Message is bound to domain, URI, and Creditcoin chain ID.</li>
          <li>Message expiration is enforced.</li>
          <li>A user-supplied address alone is never treated as proof of ownership.</li>
          <li>Contract writes are submitted by the backend relayer after SIWE proves the borrower address.</li>
        </ul>
      </section>
    </div>
  );
}
