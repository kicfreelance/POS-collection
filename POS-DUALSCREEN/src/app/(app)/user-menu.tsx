"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EndShiftDialog } from "./shifts/end-shift-dialog";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({
  fullName,
  roleName,
  hasOpenShift,
  compact = false,
}: {
  fullName: string;
  roleName: string;
  hasOpenShift: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [endShiftOpen, setEndShiftOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            compact ? (
              <Button variant="ghost" size="icon" className="size-12 rounded-2xl" aria-label="Account">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">{initials(fullName)}</AvatarFallback>
                </Avatar>
              </Button>
            ) : (
              <Button variant="ghost" className="h-9 gap-2 px-2">
                <Avatar className="size-6">
                  <AvatarFallback className="text-[0.65rem]">{initials(fullName)}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm sm:inline">{fullName}</span>
              </Button>
            )
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{fullName}</span>
                <span className="text-xs font-normal text-muted-foreground">{roleName}</span>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {hasOpenShift && (
            <DropdownMenuItem onClick={() => setEndShiftOpen(true)}>
              <Clock />
              End shift
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onClick={handleLogout}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EndShiftDialog open={endShiftOpen} onOpenChange={setEndShiftOpen} />
    </>
  );
}
