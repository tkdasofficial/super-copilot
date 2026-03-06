import { User, Settings, FileText, Shield, HelpCircle, LogOut, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ProfileMenu = () => {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center hover:bg-foreground/15 transition-colors">
          <User className="w-4 h-4 text-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => navigate("/account")}>
          <User className="w-4 h-4" />
          <span>Account</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => navigate("/settings")}>
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => navigate("/history")}>
          <Clock className="w-4 h-4" />
          <span>Chat History</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => navigate("/terms")}>
          <FileText className="w-4 h-4" />
          <span>Terms & Conditions</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => navigate("/privacy")}>
          <Shield className="w-4 h-4" />
          <span>Privacy Policy</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => navigate("/support")}>
          <HelpCircle className="w-4 h-4" />
          <span>Support</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2.5 cursor-pointer text-destructive">
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileMenu;
