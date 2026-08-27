"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, KeyRound, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { resetUserPin, setUserActive } from "./actions";

export interface UserRow {
  id: string;
  full_name: string;
  username: string;
  role_name: string;
  is_active: boolean;
}

export function UsersTable({ users }: { users: UserRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Username</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <UserRowItem key={user.id} user={user} />
        ))}
      </TableBody>
    </Table>
  );
}

function UserRowItem({ user }: { user: UserRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resetOpen, setResetOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleResetPin(event: FormEvent) {
    event.preventDefault();
    setPinError(null);
    startTransition(async () => {
      try {
        await resetUserPin(user.id, pin);
        toast.success(`PIN updated for ${user.full_name}`);
        setResetOpen(false);
        setPin("");
        router.refresh();
      } catch (err) {
        setPinError(err instanceof Error ? err.message : "Failed to reset PIN");
      }
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      try {
        await setUserActive(user.id, !user.is_active);
        toast.success(
          user.is_active ? `${user.full_name} deactivated` : `${user.full_name} activated`,
        );
        setConfirmOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update user");
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{user.full_name}</TableCell>
      <TableCell className="text-muted-foreground">{user.username}</TableCell>
      <TableCell>{user.role_name}</TableCell>
      <TableCell>
        <Badge variant={user.is_active ? "secondary" : "outline"}>
          {user.is_active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setResetOpen(true)}>
              <KeyRound /> Reset PIN
            </DropdownMenuItem>
            <DropdownMenuItem
              variant={user.is_active ? "destructive" : "default"}
              onClick={() => setConfirmOpen(true)}
            >
              {user.is_active ? <UserX /> : <UserCheck />}
              {user.is_active ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset PIN</DialogTitle>
              <DialogDescription>Set a new PIN for {user.full_name}.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleResetPin} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor={`pin-${user.id}`}>New PIN (4-8 digits)</Label>
                <Input
                  id={`pin-${user.id}`}
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4,8}"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  autoFocus
                  required
                />
              </div>
              {pinError && <p className="text-sm text-destructive">{pinError}</p>}
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {user.is_active ? "Deactivate" : "Activate"} {user.full_name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {user.is_active
                  ? "They will no longer be able to sign in."
                  : "They will be able to sign in again."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleToggleActive}
                disabled={isPending}
                className={
                  user.is_active
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : undefined
                }
              >
                {user.is_active ? "Deactivate" : "Activate"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}
