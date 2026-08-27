"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCustomer, updateCustomer, type CustomerInput } from "./actions";

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_credit_customer: boolean;
  credit_limit: string | null;
}

export function CustomerDialog({ customer }: { customer?: CustomerRecord }) {
  const router = useRouter();
  const isEdit = Boolean(customer);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [isCredit, setIsCredit] = useState(customer?.is_credit_customer ?? false);
  const [creditLimit, setCreditLimit] = useState(customer?.credit_limit ?? "");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const input: CustomerInput = {
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
      isCreditCustomer: isCredit,
      creditLimit: creditLimit ? Number(creditLimit) : null,
    };
    startTransition(async () => {
      try {
        if (isEdit && customer) {
          await updateCustomer(customer.id, input);
          toast.success(`${name} updated`);
        } else {
          await createCustomer(input);
          toast.success(`${name} added`);
          setName("");
          setPhone("");
          setEmail("");
          setAddress("");
          setIsCredit(false);
          setCreditLimit("");
        }
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save customer");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="icon-sm"><Pencil /></Button>
          ) : (
            <Button><Plus /> Add Customer</Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>Walk-in sales don&apos;t need a customer record.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="cust-name">Name</Label>
            <Input id="cust-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cust-phone">Phone</Label>
              <Input id="cust-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cust-email">Email</Label>
              <Input id="cust-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cust-address">Address</Label>
            <Input id="cust-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isCredit} onCheckedChange={(v) => setIsCredit(Boolean(v))} />
            Allow credit purchases
          </label>
          {isCredit && (
            <div className="grid gap-1.5">
              <Label htmlFor="credit-limit">Credit limit (optional)</Label>
              <Input
                id="credit-limit"
                type="number"
                min="0"
                step="0.01"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="Leave blank for no limit"
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? "Saving..." : isEdit ? "Save changes" : "Create customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
