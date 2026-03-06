import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Zap, Crown, Rocket } from "lucide-react";
import ProfileMenu from "@/components/ProfileMenu";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    icon: Zap,
    current: true,
    features: [
      "5 chats per day",
      "Basic AI tools",
      "Standard response speed",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$12",
    period: "per month",
    icon: Crown,
    popular: true,
    features: [
      "Unlimited chats",
      "All AI tools",
      "Priority response speed",
      "Chat history export",
      "Email support",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "$39",
    period: "per month",
    icon: Rocket,
    features: [
      "Everything in Pro",
      "Team collaboration",
      "API access",
      "Custom AI training",
      "Dedicated support",
      "Analytics dashboard",
    ],
  },
];

const Upgrade = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-display font-semibold text-foreground">Upgrade Plan</h1>
        <ProfileMenu />
      </header>

      <div className="flex-1 px-4 py-6 sm:px-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground mb-2">
              Choose your plan
            </h2>
            <p className="text-sm text-muted-foreground">
              Unlock more power with a plan that fits your needs.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border p-5 flex flex-col transition-all ${
                    plan.popular
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-card"
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wide">
                      Popular
                    </span>
                  )}

                  <div className="flex items-center gap-2.5 mb-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      plan.popular ? "bg-primary/10" : "bg-accent"
                    }`}>
                      <Icon className={`w-4.5 h-4.5 ${plan.popular ? "text-primary" : "text-foreground"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                    </div>
                  </div>

                  <div className="mb-5">
                    <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-xs text-muted-foreground ml-1">/{plan.period}</span>
                  </div>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      plan.current
                        ? "bg-accent text-muted-foreground cursor-default"
                        : plan.popular
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-accent text-foreground hover:bg-accent/80"
                    }`}
                    disabled={plan.current}
                  >
                    {plan.current ? "Current Plan" : "Upgrade"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upgrade;
