"use client";

import { Button, Form, InlineNotification, Stack, TextInput, Tile } from "@carbon/react";
import { ArrowRight, Login } from "@carbon/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginUser = { username: string; displayName: string; role: string; department: string };

export function LoginForm({ users }: { users: LoginUser[] }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const login = async (name: string) => {
    if (!name.trim()) {
      setError("Please enter a user name.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: name.trim() }),
    });
    if (res.ok) {
      router.push("/patients");
      router.refresh();
    } else {
      setBusy(false);
      setError((await res.json().catch(() => null))?.error ?? "Login failed.");
    }
  };

  return (
    <Tile className="login-card">
      <Stack gap={6}>
        <div>
          <h1 className="login-card__title">Log in to MediHacker</h1>
          <p className="login-card__lead">
            Your role and department are linked to your user name and decide which patient facts you see first.
          </p>
        </div>
        <Form
          aria-label="Log in"
          onSubmit={(e) => {
            e.preventDefault();
            void login(username);
          }}
        >
          <Stack gap={5}>
            <TextInput
              id="username"
              labelText="User name"
              placeholder="e.g. anaesthesia"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              invalid={!!error}
              invalidText={error ?? undefined}
              autoComplete="username"
              autoFocus
            />
            <Button type="submit" renderIcon={Login} disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </Button>
          </Stack>
        </Form>
        <section aria-labelledby="demo-users">
          <h2 id="demo-users" className="login-card__subtitle">
            Demo users
          </h2>
          <ul className="demo-users">
            {users.map((u) => (
              <li key={u.username}>
                <button type="button" className="demo-user" onClick={() => void login(u.username)} disabled={busy}>
                  <span>
                    <span className="demo-user__role">{u.role}</span>
                    <span className="demo-user__meta">
                      {u.username} · {u.department}
                    </span>
                  </span>
                  <ArrowRight size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
        {error && <InlineNotification kind="error" lowContrast title={error} hideCloseButton />}
        <p className="login-card__note">Prototype: no password is required. All patient data shown is synthetic.</p>
      </Stack>
    </Tile>
  );
}
