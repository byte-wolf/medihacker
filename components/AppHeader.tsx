"use client";

import { Wordmark } from "@/components/Logo";
import {
  Header,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderName,
  SkipToContent,
} from "@carbon/react";
import { Asleep, Light, Logout } from "@carbon/icons-react";
import { useRouter } from "next/navigation";
import { useThemeToggle } from "./ThemeRoot";

export type HeaderUser = { displayName: string; role: string; department: string } | null;

export function AppHeader({ user }: { user: HeaderUser }) {
  const router = useRouter();
  const { theme, toggle } = useThemeToggle();
  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };
  return (
    <Header aria-label="DOKuTOR">
      <SkipToContent />
      <HeaderName href={user ? "/patients" : "/login"} prefix="" className="header-logo">
        <Wordmark height={30} />
      </HeaderName>
      <HeaderGlobalBar>
        {user && (
          <div className="header-user" aria-label="Signed in user">
            <span className="header-user__name">{user.displayName}</span>
            <span className="header-user__role">
              {user.role} · {user.department}
            </span>
          </div>
        )}
        <HeaderGlobalAction
          aria-label={theme === "white" ? "Switch to dark theme" : "Switch to light theme"}
          tooltipAlignment="end"
          onClick={toggle}
        >
          {theme === "white" ? <Asleep size={20} /> : <Light size={20} />}
        </HeaderGlobalAction>
        {user && (
          <HeaderGlobalAction aria-label="Log out" tooltipAlignment="end" onClick={logout}>
            <Logout size={20} />
          </HeaderGlobalAction>
        )}
      </HeaderGlobalBar>
    </Header>
  );
}
