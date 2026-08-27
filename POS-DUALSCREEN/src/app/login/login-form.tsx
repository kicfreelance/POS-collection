"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function pressDigit(digit: string) {
    setError(null);
    setPin((prev) => (prev.length >= 8 ? prev : prev + digit));
  }

  function backspace() {
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, pin }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Login failed");
      setPin("");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-6"
      style={{
        background:
          "radial-gradient(60% 55% at 50% 0%, color-mix(in oklch, var(--primary), transparent 70%), transparent), var(--background)",
      }}
    >

      <Card className="w-full max-w-sm animate-in fade-in-0 zoom-in-95 duration-300">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>Enter your username and PIN to start your shift</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoFocus
                className="h-11 text-base"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>PIN</Label>
              <div className="flex h-12 items-center justify-center rounded-lg border border-input bg-input/30 text-2xl tracking-[0.6em]">
                {pin.length > 0 ? (
                  "•".repeat(pin.length)
                ) : (
                  <span className="text-sm tracking-normal text-muted-foreground">
                    Enter PIN
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {DIGITS.map((digit) => (
                <Button
                  type="button"
                  key={digit}
                  variant="outline"
                  onClick={() => pressDigit(digit)}
                  className="h-12 text-lg"
                >
                  {digit}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={backspace}
                className="h-12"
              >
                <Delete />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => pressDigit("0")}
                className="h-12 text-lg"
              >
                0
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPin("")}
                className="h-12 text-xs"
              >
                Clear
              </Button>
            </div>

            <p
              className={cn(
                "min-h-5 text-center text-sm text-destructive transition-opacity",
                error ? "opacity-100" : "opacity-0",
              )}
            >
              {error}
            </p>

            <Button
              type="submit"
              disabled={submitting || !username || pin.length < 4}
              className="h-11 text-base"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
