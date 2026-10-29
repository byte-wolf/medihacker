"use client";

import { Button, ComboBox, Form, InlineNotification, Stack, Tile } from "@carbon/react";
import { Login } from "@carbon/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginUser = { username: string; displayName: string; role: string; department: string };

export function LoginForm({ users }: { users: LoginUser[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<LoginUser | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = selected?.username ?? typed.trim();
    if (!username) {
      setError("Please choose or type a user name.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username }),
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
      <Form onSubmit={submit} aria-label="Log in">
        <Stack gap={6}>
          <div>
            <h1 className="login-card__title">Log in to MediHacker</h1>
            <p className="login-card__lead">
              Your role and department are linked to your user name and decide which patient facts you see first.
            </p>
          </div>
          <ComboBox<LoginUser>
            id="username"
            titleText="User name"
            placeholder="e.g. anaesthesia"
            items={users}
            itemToString={(u) => (u ? `${u.username} — ${u.role}, ${u.department}` : "")}
            onChange={({ selectedItem }) => setSelected(selectedItem ?? null)}
            onInputChange={(v) => {
              setTyped(v.split(" — ")[0]);
              if (!v) setSelected(null);
            }}
            helperText="Choose a demo user or type the user name."
            autoFocus
          />
          {error && <InlineNotification kind="error" lowContrast title={error} hideCloseButton />}
          <Button type="submit" renderIcon={Login} disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </Button>
          <p className="login-card__note">
            Prototype: no password is required. All patient data shown is synthetic.
          </p>
        </Stack>
      </Form>
    </Tile>
  );
}
