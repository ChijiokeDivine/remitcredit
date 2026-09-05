"use client";

import { useParams } from "next/navigation";
import { getEndpoint } from "@/lib/api-docs/registry";
import { EndpointView } from "@/components/api-docs/EndpointView";
import Link from "next/link";

export default function EndpointDocsPage() {
  const params = useParams();
  const slugParts = params.slug;
  const slug = Array.isArray(slugParts) ? slugParts.join("/") : String(slugParts ?? "");
  const endpoint = getEndpoint(slug);

  if (!endpoint) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl text-fg">Endpoint not found</h1>
        <p className="mt-2 text-sm text-fg-secondary">
          No documentation for <code className="text-fg">/docs/api/{slug}</code>.
        </p>
        <Link href="/docs/api" className="mt-6 inline-block text-sm text-accent underline">
          Back to API overview
        </Link>
      </div>
    );
  }

  return <EndpointView endpoint={endpoint} />;
}
