import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquare, Mail, HelpCircle, ExternalLink } from "lucide-react";
import { useState } from "react";
import ProfileMenu from "@/components/ProfileMenu";
import { toast } from "@/hooks/use-toast";

const Support = () => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!subject.trim() || !message.trim()) return;
    setSubmitted(true);
    toast({ title: "Message sent", description: "We'll get back to you within 24 hours." });
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-display font-semibold text-foreground">Support</h1>
        <ProfileMenu />
      </header>

      <div className="flex-1 px-4 py-6 sm:px-6 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Quick links */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">How can we help?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: HelpCircle, label: "FAQ", desc: "Common questions answered", link: "#" },
                { icon: MessageSquare, label: "Community", desc: "Join our Discord", link: "#" },
                { icon: Mail, label: "Email Us", desc: "support@supercopilot.ai", link: "#" },
                { icon: ExternalLink, label: "Documentation", desc: "Guides & tutorials", link: "#" },
              ].map((item, i) => (
                <button key={i} className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left">
                  <item.icon className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Contact form */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">Send a message</h2>
            {submitted ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center animate-fade-up">
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-5 h-5 text-success" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Message sent!</p>
                <p className="text-xs text-muted-foreground mb-4">We'll respond within 24 hours.</p>
                <button
                  onClick={() => { setSubmitted(false); setSubject(""); setMessage(""); }}
                  className="text-sm text-foreground underline underline-offset-4 hover:opacity-70"
                >
                  Send another
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Subject</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="What do you need help with?"
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue or question..."
                    rows={4}
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/20 transition-colors resize-none"
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!subject.trim() || !message.trim()}
                  className="w-full py-2.5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  Send message
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Support;
