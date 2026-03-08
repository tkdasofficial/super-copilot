import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, CreditCard, MessageSquare, TrendingUp, Activity, Zap,
  ArrowUpRight, ArrowDownRight, Clock, Server,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

type Stats = {
  totalUsers: number;
  proUsers: number;
  freeUsers: number;
  businessUsers: number;
  totalSessions: number;
  totalMessages: number;
  activeTasks: number;
  totalNotifications: number;
};

const COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground))", "hsl(var(--accent-foreground))"];

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, proUsers: 0, freeUsers: 0, businessUsers: 0,
    totalSessions: 0, totalMessages: 0, activeTasks: 0, totalNotifications: 0,
  });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [userGrowth, setUserGrowth] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [profilesRes, subsRes, notifsRes, sessionsRes, msgsRes, tasksRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("*"),
        supabase.from("admin_notifications").select("id"),
        supabase.from("chat_sessions").select("id, title, user_id, created_at, updated_at").order("updated_at", { ascending: false }).limit(10),
        supabase.from("chat_messages").select("id", { count: "exact", head: true }),
        supabase.from("background_tasks").select("id, status").in("status", ["pending", "running"]),
      ]);

      const profiles = profilesRes.data || [];
      const subs = subsRes.data || [];
      const sessions = sessionsRes.data || [];

      setRecentUsers(profiles.slice(0, 5));
      setRecentSessions(sessions.slice(0, 5));

      // Build user growth data (last 7 days)
      const now = new Date();
      const growth = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dayStr = date.toLocaleDateString("en", { weekday: "short" });
        const count = profiles.filter((p: any) => {
          const d = new Date(p.created_at);
          return d.toDateString() === date.toDateString();
        }).length;
        growth.push({ day: dayStr, users: count });
      }
      setUserGrowth(growth);

      setStats({
        totalUsers: subs.length || profiles.length,
        proUsers: subs.filter((s: any) => s.plan === "pro").length,
        freeUsers: subs.filter((s: any) => s.plan === "free").length,
        businessUsers: subs.filter((s: any) => s.plan === "business").length,
        totalSessions: sessions.length,
        totalMessages: msgsRes.count || 0,
        activeTasks: (tasksRes.data || []).length,
        totalNotifications: (notifsRes.data || []).length,
      });
      setLoading(false);
    };
    load();
  }, []);

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-primary", trend: "+12%", up: true },
    { label: "Pro / Business", value: stats.proUsers + stats.businessUsers, icon: CreditCard, color: "text-primary", trend: `${stats.totalUsers ? Math.round(((stats.proUsers + stats.businessUsers) / stats.totalUsers) * 100) : 0}%`, up: true },
    { label: "Chat Sessions", value: stats.totalSessions, icon: MessageSquare, color: "text-foreground" },
    { label: "Messages", value: stats.totalMessages, icon: TrendingUp, color: "text-foreground" },
    { label: "Active Tasks", value: stats.activeTasks, icon: Zap, color: "text-primary" },
    { label: "Notifications", value: stats.totalNotifications, icon: Activity, color: "text-muted-foreground" },
  ];

  const pieData = [
    { name: "Free", value: stats.freeUsers },
    { name: "Pro", value: stats.proUsers },
    { name: "Business", value: stats.businessUsers },
  ].filter((d) => d.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-foreground">Dashboard</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Server className="w-3.5 h-3.5" />
          <span>System Online</span>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-border bg-card p-4 hover:border-primary/20 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-4 h-4 ${card.color}`} />
                {card.trend && (
                  <span className="flex items-center gap-0.5 text-xs text-green-500">
                    {card.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {card.trend}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* User Growth Chart */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">User Signups (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={userGrowth}>
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" fill="url(#colorUsers)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Plan Distribution */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Plan Distribution</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No data</div>
          )}
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-muted-foreground">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent Users */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Recent Users</h3>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {recentUsers.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {(user.full_name || user.email || "?")[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-foreground text-sm font-medium truncate">{user.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </td>
                </tr>
              ))}
              {recentUsers.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">No users yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Recent Chat Sessions */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Recent Chat Sessions</h3>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {recentSessions.map((session) => (
                <tr key={session.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="text-foreground text-sm truncate max-w-[200px]">{session.title || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground">{session.user_id?.slice(0, 8)}...</p>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                    {new Date(session.updated_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {recentSessions.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">No sessions</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
