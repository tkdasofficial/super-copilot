import { useNavigate } from "react-router-dom";
import { ArrowLeft, Globe, Bell, BellOff, Trash2, Download, AlertTriangle } from "lucide-react";
import { useState } from "react";
import ProfileMenu from "@/components/ProfileMenu";

const Settings = () => {
  const navigate = useNavigate();
  const [language, setLanguage] = useState("English");
  const [notifications, setNotifications] = useState(true);
  const [defaultTool, setDefaultTool] = useState("Main Chat");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-display font-semibold text-foreground">Settings</h1>
        <ProfileMenu />
      </header>

      <div className="flex-1 px-4 py-6 sm:px-6 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Preferences */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">Preferences</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Language</p>
                    <p className="text-xs text-muted-foreground">Interface language</p>
                  </div>
                </div>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-accent text-foreground text-xs rounded-lg px-3 py-1.5 border-none outline-none cursor-pointer"
                >
                  <option>English</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>Hindi</option>
                  <option>Arabic</option>
                </select>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  {notifications ? <Bell className="w-4 h-4 text-muted-foreground" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-medium text-foreground">Notifications</p>
                    <p className="text-xs text-muted-foreground">Push & email alerts</p>
                  </div>
                </div>
                <button
                  onClick={() => setNotifications(!notifications)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${notifications ? "bg-foreground" : "bg-muted"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-background absolute top-1 transition-all ${notifications ? "left-5" : "left-1"}`} />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Default tool</p>
                  <p className="text-xs text-muted-foreground">Opens on launch</p>
                </div>
                <select
                  value={defaultTool}
                  onChange={(e) => setDefaultTool(e.target.value)}
                  className="bg-accent text-foreground text-xs rounded-lg px-3 py-1.5 border-none outline-none cursor-pointer"
                >
                  <option>Main Chat</option>
                  <option>Script Writer</option>
                  <option>Thumbnails</option>
                  <option>SEO</option>
                  <option>Images</option>
                </select>
              </div>
            </div>
          </section>

          {/* Data & Privacy */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">Data & Privacy</h2>
            <div className="space-y-3">
              <button className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-accent transition-colors text-left">
                <Download className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Export data</p>
                  <p className="text-xs text-muted-foreground">Download all your conversations & data</p>
                </div>
              </button>

              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-accent transition-colors text-left"
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Clear all history</p>
                  <p className="text-xs text-muted-foreground">Delete all saved conversations</p>
                </div>
              </button>

              <button
                onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                className="w-full flex items-center gap-3 rounded-xl border border-destructive/30 bg-card p-4 hover:bg-destructive/5 transition-colors text-left"
              >
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">Delete account</p>
                  <p className="text-xs text-muted-foreground">Permanently delete your account & data</p>
                </div>
              </button>

              {showDeleteConfirm && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 animate-fade-up">
                  <p className="text-sm text-foreground mb-3">Are you sure? This action cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                    <button className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
