"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createGrn, type GrnItemInput } from "./actions";
import type { SupplierRow } from "../suppliers/supplier-dialog";

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  base_unit: string;
  cost_price: string;
}

let rowId = 0;
function nextRowId() {
  rowId += 1;
  return rowId;
}

interface DraftItem extends GrnItemInput {
  key: number;
}

export function GrnForm({
  suppliers,
  products,
}: {
  suppliers: SupplierRow[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");

  // base-ui <Select.Value> shows the raw value (a UUID here) unless the Root is
  // given an items map — then it renders the matching label instead.
  const supplierItems = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.name })),
    [suppliers],
  );
  const productItems = useMemo(
    () => products.map((p) => ({ value: p.id, label: `${p.name} (${p.base_unit})` })),
    [products],
  );
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        key: nextRowId(),
        productId: "",
        batchNumber: `B${Date.now().toString().slice(-8)}`,
        quantity: 1,
        costPrice: 0,
        expiryDate: null,
      },
    ]);
  }

  function updateItem(key: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);

  function handleSubmit() {
    setError(null);
    if (!supplierId) {
      setError("Select a supplier");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one line item");
      return;
    }
    if (items.some((item) => !item.productId)) {
      setError("Select a product for every line");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createGrn({
          supplierId,
          receivedDate,
          notes: notes || null,
          items: items.map(({ key, ...rest }) => {
            void key;
            return rest;
          }),
        });
        toast.success(`${result.grnNumber} created`);
        router.push("/grn");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create GRN");
      }
    });
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">GRN details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Supplier</Label>
            <Select
              items={supplierItems}
              value={supplierId}
              onValueChange={(value) => setSupplierId(value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="receivedDate">Received date</Label>
            <Input
              id="receivedDate"
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Line items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus /> Add line
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No items yet. Add a line to get started.</p>
          )}
          {items.map((item) => (
            <div
              key={item.key}
              className="grid grid-cols-1 items-end gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-6"
            >
              <div className="grid gap-1 sm:col-span-2">
                <Label className="text-xs">Product</Label>
                <Select
                  items={productItems}
                  value={item.productId}
                  onValueChange={(value) => updateItem(item.key, { productId: value ?? "" })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.base_unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Batch #</Label>
                <Input
                  value={item.batchNumber}
                  onChange={(e) => updateItem(item.key, { batchNumber: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.key, { quantity: Number(e.target.value) })}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Cost price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.costPrice}
                  onChange={(e) => updateItem(item.key, { costPrice: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-end gap-1">
                <div className="grid flex-1 gap-1">
                  <Label className="text-xs">Expiry (optional)</Label>
                  <Input
                    type="date"
                    value={item.expiryDate ?? ""}
                    onChange={(e) => updateItem(item.key, { expiryDate: e.target.value || null })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeItem(item.key)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          {items.length > 0 && (
            <p className="text-right text-sm text-muted-foreground">
              Total cost: <span className="font-semibold text-foreground">{total.toFixed(2)}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Saving..." : "Create GRN"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/grn")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
