"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Barcode as BarcodeIcon } from "lucide-react";
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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createProduct, generateBarcode, updateProduct, type ProductInput } from "./actions";
import type { UnitOption } from "@/lib/units-server";
import type { CategoryRow } from "./categories-dialog";
import type { SupplierRow } from "../suppliers/supplier-dialog";

const NONE = "__none__";

export interface ProductRecord {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  supplier_id: string | null;
  base_unit: string;
  cost_price: string;
  selling_price: string;
  tax_rate: string;
  discount_type: "percentage" | "flat" | null;
  discount_value: string | null;
  reorder_threshold: string;
  image_data_url: string | null;
}

const MAX_IMAGE_DIMENSION = 300;

function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ProductForm({
  product,
  categories,
  suppliers,
  units,
}: {
  product?: ProductRecord;
  categories: CategoryRow[];
  suppliers: SupplierRow[];
  units: UnitOption[];
}) {
  const router = useRouter();
  const isEdit = Boolean(product);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? NONE);
  const [supplierId, setSupplierId] = useState(product?.supplier_id ?? NONE);
  const [baseUnit, setBaseUnit] = useState(product?.base_unit ?? "pcs");
  const [costPrice, setCostPrice] = useState(product?.cost_price ?? "0");
  const [sellingPrice, setSellingPrice] = useState(product?.selling_price ?? "0");
  const [taxRate, setTaxRate] = useState(product?.tax_rate ?? "0");
  const [discountType, setDiscountType] = useState<"percentage" | "flat" | typeof NONE>(
    product?.discount_type ?? NONE,
  );
  const [discountValue, setDiscountValue] = useState(product?.discount_value ?? "0");
  const [reorderThreshold, setReorderThreshold] = useState(product?.reorder_threshold ?? "0");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(product?.image_data_url ?? null);
  const [generating, setGenerating] = useState(false);

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file);
      setImageDataUrl(dataUrl);
    } catch {
      toast.error("Failed to load image");
    }
  }

  async function handleGenerateBarcode() {
    setGenerating(true);
    try {
      const code = await generateBarcode();
      setBarcode(code);
    } catch {
      toast.error("Failed to generate barcode");
    } finally {
      setGenerating(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const input: ProductInput = {
      name,
      sku,
      barcode: barcode || null,
      categoryId: categoryId === NONE ? null : categoryId,
      supplierId: supplierId === NONE ? null : supplierId,
      baseUnit,
      costPrice: Number(costPrice),
      sellingPrice: Number(sellingPrice),
      taxRate: Number(taxRate),
      discountType: discountType === NONE ? null : discountType,
      discountValue: discountType === NONE ? null : Number(discountValue),
      reorderThreshold: Number(reorderThreshold),
      imageDataUrl,
    };

    startTransition(async () => {
      try {
        if (isEdit && product) {
          await updateProduct(product.id, input);
          toast.success(`${name} updated`);
        } else {
          await createProduct(input);
          toast.success(`${name} created`);
        }
        router.push("/products");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save product");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic info</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Product image</Label>
            <div className="flex items-center gap-3">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/30">
                {imageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageDataUrl} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">No image</span>
                )}
              </div>
              <div className="flex gap-2">
                <label className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}>
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
                {imageDataUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImageDataUrl(null)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Shown as a tile image on the restaurant POS terminal.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="name">Product name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} required />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="barcode">Barcode</Label>
            <div className="flex gap-2">
              <Input
                id="barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or enter a barcode"
              />
              <Button type="button" variant="outline" onClick={handleGenerateBarcode} disabled={generating}>
                <BarcodeIcon />
                Generate
              </Button>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? NONE)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={(value) => setSupplierId(value ?? NONE)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unit &amp; stock</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Base stock unit</Label>
            <Select value={baseUnit} onValueChange={(value) => value && setBaseUnit(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.code} value={unit.code}>
                    {unit.name} ({unit.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reorderThreshold">Reorder threshold</Label>
            <Input
              id="reorderThreshold"
              type="number"
              min="0"
              step="0.001"
              value={reorderThreshold}
              onChange={(e) => setReorderThreshold(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing &amp; tax</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="costPrice">Cost price</Label>
            <Input
              id="costPrice"
              type="number"
              min="0"
              step="0.01"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sellingPrice">Selling price</Label>
            <Input
              id="sellingPrice"
              type="number"
              min="0"
              step="0.01"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="taxRate">Tax rate (%)</Label>
            <Input
              id="taxRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Product discount</Label>
            <Select
              value={discountType}
              onValueChange={(value) => setDiscountType((value as typeof discountType) ?? NONE)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No discount</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="flat">Flat amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {discountType !== NONE && (
            <div className="grid gap-1.5">
              <Label htmlFor="discountValue">
                Discount value {discountType === "percentage" ? "(%)" : ""}
              </Label>
              <Input
                id="discountValue"
                type="number"
                min="0"
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : isEdit ? "Save changes" : "Create product"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/products")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
