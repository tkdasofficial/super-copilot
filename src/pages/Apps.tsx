import { AI_TOOLS } from "@/lib/mock-data";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ProfileMenu from "@/components/ProfileMenu";
import logo from "@/assets/logo.svg";

const Apps = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src={logo} alt="Super Copilot" className="w-6 h-6 rounded-full object-cover" />
          <h1 className="text-sm font-display font-semibold text-foreground">Explore Apps</h1>
        </div>
        <ProfileMenu />
      </header>

      <div className="flex-1 px-4 py-6 sm:px-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground mb-1">
            AI Tools Library
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Specialized AI workers for every content creation task.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AI_TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => navigate(`/tool/${tool.id}`)}
                  className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0 group-hover:bg-background transition-colors">
                    <Icon className="w-5 h-5 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-display font-semibold text-foreground mb-0.5">{tool.name}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tool.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Apps;
