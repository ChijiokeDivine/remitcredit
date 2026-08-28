"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useWallet } from "../../lib/wallet";
import { getActivity, getBorrowerActivity, type ActivityEvent } from "../../lib/api";
import { shortAddress, relativeTime, formatAmount, cn } from "../../lib/utils";
import { Activity, UserPlus, ShieldCheck, Gauge, Banknote, RefreshCw } from "lucide-react";

const TYPE_META: Record<string, { label: string; icon: typeof Activity; tone: "default" | "success" | "muted" | "outline" }> = {
  borrower_registered: { label: "Registered", icon: UserPlus, tone: "outline" },
  remittance_verified: { label: "Verified", icon: ShieldCheck, tone: "success" },
  credit_reviewed: { label: "Credit review", icon: Gauge, tone: "default" },
  loan_disbursed: { label: "Loan drawn", icon: Banknote, tone: "default" },
  loan_repaid: { label: "Repaid", icon: Banknote, tone: "success" },
};

function EventRow({ event }: { event: ActivityEvent }) {
  const meta = TYPE_META[event.type] ?? { label: event.type, icon: Activity, tone: "muted" as const };
  const Icon = meta.icon;
  const data = event.data || {};
  let detail = "";
  if (event.type === "remittance_verified" && data.amount) detail = `$${formatAmount(String(data.amount))}`;
  else if (event.type === "loan_disbursed" && data.amount) detail = `$${formatAmount(String(data.amount))}`;
  else if (event.type === "loan_repaid" && data.amount) detail = `$${formatAmount(String(data.amount))}`;
  else if (event.type === "credit_reviewed" && data.creditLimit) detail = `Limit $${formatAmount(String(data.creditLimit))}`;
  else if (data.action === "sender_added") detail = `Added ${shortAddress(String(data.sender))}`;
  else if (data.action === "sender_removed") detail = `Removed ${shortAddress(String(data.sender))}`;

  return (
    <div className="flex items-start gap-4 py-4 transition-colors first:pt-0 last:pb-0 hover:bg-bg-muted/40">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-muted">
        <Icon className="h-4 w-4 text-fg" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {detail && <span className="text-sm font-medium text-fg">{detail}</span>}
        </div>
        <p className="mt-1 font-mono text-xs text-fg-muted">
          {shortAddress(event.borrower, 5)}
          {data.txHash ? ` · ${shortAddress(String(data.txHash), 4)}` : ""}
        </p>
      </div>
      <p className="shrink-0 text-xs text-fg-muted">{event.timestamp ? relativeTime(event.timestamp) : ""}</p>
    </div>
  );
}

export default function ActivityPage() {
  const { address } = useWallet();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (scope === "mine" && address) {
        const res = await getBorrowerActivity(address);
        setEvents(res.events ?? []);
      } else {
        const res = await getActivity(50);
        setEvents(res.events ?? []);
      }
    } catch { setEvents([]); } finally { setLoading(false); }
  }, [address, scope]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <AppShell>
      <div className="animate-fade-up">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal tracking-tight text-fg md:text-4xl">Activity</h1>
            <p className="mt-2 text-[15px] text-fg-secondary">Live feed: detect → verify → decide → execute.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex rounded-md border border-border p-0.5">
              <span
                className={cn(
                  "absolute inset-y-0.5 w-[calc(50%-2px)] rounded bg-fg transition-transform duration-200 ease-out",
                  scope === "mine" ? "translate-x-[calc(100%+4px)]" : "translate-x-0"
                )}
              />
              <button type="button" onClick={() => setScope("all")} className={cn("relative z-10 rounded px-3 py-1.5 text-xs font-medium transition-colors", scope === "all" ? "text-bg" : "text-fg-secondary hover:text-fg")}>All</button>
              <button type="button" onClick={() => setScope("mine")} disabled={!address} className={cn("relative z-10 rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40", scope === "mine" ? "text-bg" : "text-fg-secondary hover:text-fg")}>Mine</button>
            </div>
            <Button variant="outline" size="sm" onClick={load} loading={loading}><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <Card>
          {loading && events.length === 0 ? (
            <div className="space-y-4">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-12 w-full" />)}</div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Activity className="mb-3 h-8 w-8 text-fg-muted" strokeWidth={1.5} />
              <p className="text-sm text-fg-secondary">No activity yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {events.map((ev, i) => <EventRow key={ev.id ?? `${ev.type}-${ev.timestamp}-${i}`} event={ev} />)}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
