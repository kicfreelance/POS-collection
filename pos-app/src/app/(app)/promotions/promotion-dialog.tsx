"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createPromotion, type PromotionInput } from "./actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PromotionDialog({
  products,
  categories,
}: {
  products: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<PromotionInput["type"]>("percentage_off");
  const [targetType, setTargetType] = useState<"product" | "category">("product");
  const [targetId, setTargetId] = useState("");
  const [value, setValue] = useState("10");
  const [buyQuantity, setBuyQuantity] = useState("1");
  const [getQuantity, setGetQuantity] = useState("1");
  const [getDiscountPercent, setGetDiscountPercent] = useState("100");
  const [bundleQuantity, setBundleQuantity] = useState("3");
  const [bundlePrice, setBundlePrice] = useState("0");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [days, setDays] = useState<number[]>([]);

  function toggleDay(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const input: PromotionInput = {
      name,
      type,
      targetType,
      targetId,
      value: ["percentage_off", "flat_off"].includes(type) ? Number(value) : null,
      buyQuantity: type === "buy_x_get_y" ? Number(buyQuantity) : null,
      getQuantity: type === "buy_x_get_y" ? Number(getQuantity) : null,
      getDiscountPercent: type === "buy_x_get_y" ? Number(getDiscountPercent) : null,
      bundleQuantity: type === "bundle" ? Number(bundleQuantity) : null,
      bundlePrice: type === "bundle" ? Number(bundlePrice) : null,
      startAt: startAt || null,
      endAt: endAt || null,
      recurringDaysOfWeek: days.length > 0 ? days : null,
    };

    startTransition(async () => {
      try {
        await createPromotion(input);
        toast.success(`Promotion "${name}" created`);
        setOpen(false);
        setName("");
        setTargetId("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create promotion");
      }
    });
  }

  const targetOptions = targetType === "product" ? products : categories;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus /> Add Promotion</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add promotion</DialogTitle>
          <DialogDescription>Surfaces automatically at checkout when eligible.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="promo-name">Name</Label>
            <Input id="promo-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => v && setType(v as PromotionInput["type"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage_off">Percentage off</SelectItem>
                  <SelectItem value="flat_off">Flat amount off</SelectItem>
                  <SelectItem value="buy_x_get_y">Buy X get Y</SelectItem>
                  <SelectItem value="bundle">Bundle price</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Applies to</Label>
              <Select
                value={targetType}
                onValueChange={(v) => {
                  if (!v) return;
                  setTargetType(v as "product" | "category");
                  setTargetId("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>{targetType === "product" ? "Product" : "Category"}</Label>
            <Select value={targetId} onValueChange={(v) => setTargetId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {targetOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(type === "percentage_off" || type === "flat_off") && (
            <div className="grid gap-1.5">
              <Label htmlFor="promo-value">
                {type === "percentage_off" ? "Percentage off (%)" : "Amount off"}
              </Label>
              <Input
                id="promo-value"
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          )}

          {type === "buy_x_get_y" && (
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Buy qty</Label>
                <Input type="number" min="1" value={buyQuantity} onChange={(e) => setBuyQuantity(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Get qty</Label>
                <Input type="number" min="1" value={getQuantity} onChange={(e) => setGetQuantity(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Get discount %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={getDiscountPercent}
                  onChange={(e) => setGetDiscountPercent(e.target.value)}
                />
              </div>
            </div>
          )}

          {type === "bundle" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Bundle quantity</Label>
                <Input
                  type="number"
                  min="2"
                  value={bundleQuantity}
                  onChange={(e) => setBundleQuantity(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Bundle price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bundlePrice}
                  onChange={(e) => setBundlePrice(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Start (optional)</Label>
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">End (optional)</Label>
              <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Repeat on days (optional — leave blank for every day)</Label>
            <div className="flex flex-wrap gap-3">
              {DAYS.map((label, index) => (
                <label key={index} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    checked={days.includes(index)}
                    onCheckedChange={() => toggleDay(index)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending || !targetId}>
              {isPending ? "Creating..." : "Create promotion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
