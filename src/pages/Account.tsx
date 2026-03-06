import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail } from "lucide-react";
import { useState } from "react";
import ProfileMenu from "@/components/ProfileMenu";

const MOCK_USER = {
  name: "Alex Johnson",
  email: "alex@example.com",
  avatar: "",
  plan: "Free",
};

const Account = () => {
  const navigate = useNavigate();
  const [name, setName] = useState(MOCK_USER.name);
  const [email] = useState(MOCK_USER.email);

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
                <div className="w-16 h-16 rounded-full bg-foreground/10 flex items-center justify-center">
                  <User className="w-7 h-7 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">{MOCK_USER.plan} plan</p>
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
                  <span className="text-sm text-foreground">{email}</span>
                </div>
              </div>

              <button className="w-full py-2.5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity">
                Save changes
              </button>
            </div>
          </section>

          {/* Plan */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">Plan</h2>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Free Plan</p>
                  <p className="text-xs text-muted-foreground">5 AI workers · 50 prompts/day</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">Current</span>
              </div>
              <button className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors">
                Upgrade to Pro
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Account;
