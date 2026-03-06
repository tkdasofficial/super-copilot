import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, CreditCard, MessageSquare, TrendingUp } from "lucide-react";

type Stats = {
  totalUsers: number;
  proUsers: number;
  freeUsers: number;
  totalNotifications: number;
};

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, proUsers: 0, freeUsers: 0, totalNotifications: 0 });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [profilesRes, subsRes, notifsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("subscriptions").select("*"),
        supabase.from("admin_notifications").select("id"),
      ]);

      const profiles = profilesRes.data || [];
      const subs = subsRes.data || [];
      const notifs = notifsRes.data || [];

      setRecentUsers(profiles);
      setStats({
        totalUsers: profiles.length > 4 ? subs.length : profiles.length,
        proUsers: subs.filter((s) => s.plan === "pro" || s.plan === "business").length,
        freeUsers: subs.filter((s) => s.plan === "free").length,
        totalNotifications: notifs.length,
      });
      setLoading(false);
    };
    load();
  }, []);

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "Pro Users", value: stats.proUsers, icon: CreditCard, color: "text-primary" },
    { label: "Free Users", value: stats.freeUsers, icon: TrendingUp, color: "text-muted-foreground" },
    { label: "Notifications Sent", value: stats.totalNotifications, icon: MessageSquare, color: "text-muted-foreground" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <h2 className="font-display text-lg font-semibold text-foreground">Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${card.color}`} />
                <span className="text-xs text-muted-foreground">{card.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="font-display text-sm font-semibold text-foreground mb-3">Recent Users</h3>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-accent/40">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-foreground">{user.full_name || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{user.email || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {recentUsers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No users yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
