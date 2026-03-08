import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, KeyRound, ShieldCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ProfileMenu from "@/components/ProfileMenu";

const Account = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, user } = useAuth();
  const [name, setName] = useState(profile?.full_name || "");
  const [sub, setSub] = useState<any>(null);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (profile) setName(profile.full_name || "");
  }, [profile]);

  useEffect(() => {
    if (user) {
      supabase.from("subscriptions").select("*").eq("user_id", user.id).single().then(({ data }) => {
        if (data) setSub(data);
      });
      supabase.from("user_2fa").select("enabled").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        if (data) setTwoFAEnabled(data.enabled);
      });
    }
  }, [user]);

  const saveName = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ full_name: name, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-display font-semibold text-foreground">Account</h1>
        <ProfileMenu />
      </header>

      <div className="flex-1 px-4 py-6 sm:px-6 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Profile */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">Profile</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-foreground/10 flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-7 h-7 text-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{name || "User"}</p>
                  <p className="text-xs text-muted-foreground">{sub?.plan || "free"} plan</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none focus:border-foreground/20 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{profile?.email || user?.email || ""}</span>
                </div>
              </div>

              <button onClick={saveName} className="w-full py-2.5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity">
                Save changes
              </button>
            </div>
          </section>

          {/* Security */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">Security</h2>
            <div className="space-y-4">
              <button
                onClick={async () => {
                  const email = profile?.email || user?.email;
                  if (!email) return;
                  setResetLoading(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  setResetLoading(false);
                  if (error) {
                    toast({ title: "Error", description: error.message, variant: "destructive" });
                  } else {
                    toast({ title: "Check your email", description: "We sent you a password reset link." });
                  }
                }}
                disabled={resetLoading}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left"
              >
                <KeyRound className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Reset Password</p>
                  <p className="text-xs text-muted-foreground">Send a password reset link to your email</p>
                </div>
                {resetLoading && <div className="w-4 h-4 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />}
              </button>

              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card">
                <ShieldCheck className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                  <p className="text-xs text-muted-foreground">Receive an email code on every login</p>
                </div>
                <button
                  disabled={twoFALoading}
                  onClick={async () => {
                    if (!user) return;
                    setTwoFALoading(true);
                    const newVal = !twoFAEnabled;
                    const { data: existing } = await supabase.from("user_2fa").select("id").eq("user_id", user.id).maybeSingle();
                    if (existing) {
                      await supabase.from("user_2fa").update({ enabled: newVal, updated_at: new Date().toISOString() }).eq("user_id", user.id);
                    } else {
                      await supabase.from("user_2fa").insert({ user_id: user.id, enabled: newVal });
                    }
                    setTwoFAEnabled(newVal);
                    setTwoFALoading(false);
                    toast({ title: newVal ? "2FA enabled" : "2FA disabled" });
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors ${twoFAEnabled ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`block w-5 h-5 bg-background rounded-full shadow transition-transform ${twoFAEnabled ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Account;
