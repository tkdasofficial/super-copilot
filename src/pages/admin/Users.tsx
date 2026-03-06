import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AdminUsers = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [profilesRes, rolesRes, subsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("subscriptions").select("*"),
    ]);

    const profiles = profilesRes.data || [];
    const allRoles = rolesRes.data || [];
    const subs = subsRes.data || [];

    const roleMap: Record<string, string[]> = {};
    allRoles.forEach((r: any) => {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
      roleMap[r.user_id].push(r.role);
    });

    const usersWithSubs = profiles.map((p: any) => ({
      ...p,
      plan: subs.find((s: any) => s.user_id === p.id)?.plan || "free",
    }));

    setUsers(usersWithSubs);
    setRoles(roleMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleAdmin = async (userId: string) => {
    const isCurrentlyAdmin = roles[userId]?.includes("admin");
    if (isCurrentlyAdmin) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
    }
    toast({ title: isCurrentlyAdmin ? "Admin removed" : "Admin granted" });
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
      <h2 className="font-display text-lg font-semibold text-foreground">Users</h2>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-border bg-accent/40">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Plan</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Role</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-foreground">{user.full_name || "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{user.email || "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.plan === "pro" ? "bg-primary/10 text-primary" :
                    user.plan === "business" ? "bg-primary/10 text-primary" :
                    "bg-accent text-muted-foreground"
                  }`}>
                    {user.plan}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {roles[user.id]?.includes("admin") && (
                    <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">admin</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => toggleAdmin(user.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title={roles[user.id]?.includes("admin") ? "Remove admin" : "Make admin"}
                  >
                    <Shield className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
