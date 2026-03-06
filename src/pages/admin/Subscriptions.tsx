import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PLANS = ["free", "pro", "business"];

const AdminSubscriptions = () => {
  const { toast } = useToast();
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: subsData } = await supabase.from("subscriptions").select("*").order("created_at", { ascending: false });
    const { data: profiles } = await supabase.from("profiles").select("id, email, full_name");

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

    const enriched = (subsData || []).map((s: any) => ({
      ...s,
      email: profileMap[s.user_id]?.email || "—",
      name: profileMap[s.user_id]?.full_name || "—",
    }));

    setSubs(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const changePlan = async (subId: string, newPlan: string) => {
    await supabase.from("subscriptions").update({ plan: newPlan }).eq("id", subId);
    toast({ title: "Plan updated", description: `Changed to ${newPlan}` });
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <h2 className="font-display text-lg font-semibold text-foreground">Subscriptions</h2>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-border bg-accent/40">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">User</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Plan</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Change Plan</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((sub) => (
              <tr key={sub.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-foreground">{sub.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{sub.email}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    sub.plan !== "free" ? "bg-primary/10 text-primary" : "bg-accent text-muted-foreground"
                  }`}>
                    {sub.plan}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
                    {sub.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <select
                    value={sub.plan}
                    onChange={(e) => changePlan(sub.id, e.target.value)}
                    className="px-2 py-1 rounded-lg border border-border bg-card text-sm text-foreground outline-none"
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {subs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No subscriptions</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminSubscriptions;
