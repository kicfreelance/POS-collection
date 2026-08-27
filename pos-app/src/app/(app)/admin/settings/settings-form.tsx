"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Printer, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  updateBusinessSettings,
  listRestaurantTables,
  createRestaurantTable,
  setRestaurantTableActive,
  listKitchenStations,
  createKitchenStation,
  setKitchenStationPrinter,
  setKitchenStationActive,
  listCategoriesWithStations,
  setCategoryStation,
  listProductsWithStations,
  setProductStation,
  type BusinessSettingsInput,
  type RestaurantTableRow,
  type KitchenStationRow,
  type CategoryStationRow,
  type ProductStationRow,
} from "./actions";
import type { BusinessSettings } from "@/lib/settings-server";
import type { PrinterInfo } from "@/types/electron";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Receipt } from "@/lib/receipt/receipt";
import { SAMPLE_RECEIPT } from "@/lib/receipt/sample";
import {
  RECEIPT_TEMPLATES,
  type ReceiptFontSize,
  type ReceiptPaperWidth,
  type ReceiptStyle,
  type ReceiptTemplate,
} from "@/lib/receipt/types";

const NO_PRINTER = "__none__";

export function SettingsForm({ settings }: { settings: BusinessSettings }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState(settings.businessName);
  const [address, setAddress] = useState(settings.address ?? "");
  const [taxId, setTaxId] = useState(settings.taxId ?? "");
  const [contactPhone, setContactPhone] = useState(settings.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(settings.contactEmail ?? "");
  const [taxInclusive, setTaxInclusive] = useState(settings.taxInclusivePricing);
  const [receiptHeader, setReceiptHeader] = useState(settings.receiptHeader ?? "");
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter ?? "");
  const [currencyCode, setCurrencyCode] = useState(settings.currencyCode);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);
  const [locale, setLocale] = useState(settings.locale);
  const [costingMethod, setCostingMethod] = useState(settings.costingMethod);
  const [businessType, setBusinessType] = useState(settings.businessType);
  const [receiptPrinterName, setReceiptPrinterName] = useState(settings.receiptPrinterName ?? NO_PRINTER);
  const [kotPrinterName, setKotPrinterName] = useState(settings.kotPrinterName ?? NO_PRINTER);
  const [labelPrinterName, setLabelPrinterName] = useState(settings.labelPrinterName ?? NO_PRINTER);
  const [receiptTemplate, setReceiptTemplate] = useState<ReceiptTemplate>(settings.receiptTemplate);
  const [receiptPaperWidth, setReceiptPaperWidth] = useState<ReceiptPaperWidth>(settings.receiptPaperWidth);
  const [receiptFontSize, setReceiptFontSize] = useState<ReceiptFontSize>(settings.receiptFontSize);
  const [receiptShowLogo, setReceiptShowLogo] = useState(settings.receiptShowLogo);
  const [receiptShowTaxId, setReceiptShowTaxId] = useState(settings.receiptShowTaxId);
  const [receiptShowCashier, setReceiptShowCashier] = useState(settings.receiptShowCashier);
  const [receiptShowBarcode, setReceiptShowBarcode] = useState(settings.receiptShowBarcode);
  const [receiptAutoPrint, setReceiptAutoPrint] = useState(settings.receiptAutoPrint);

  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [printersLoaded, setPrintersLoaded] = useState(false);
  const [tables, setTables] = useState<RestaurantTableRow[]>([]);
  const [tablesLoaded, setTablesLoaded] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [tableBusy, setTableBusy] = useState(false);

  const [stations, setStations] = useState<KitchenStationRow[]>([]);
  const [stationsLoaded, setStationsLoaded] = useState(false);
  const [newStationName, setNewStationName] = useState("");
  const [stationBusy, setStationBusy] = useState(false);
  const [categoryStations, setCategoryStations] = useState<CategoryStationRow[]>([]);
  const [categoryStationsLoaded, setCategoryStationsLoaded] = useState(false);
  const [productStations, setProductStations] = useState<ProductStationRow[]>([]);
  const [productStationsLoaded, setProductStationsLoaded] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    // Printer list is needed in retail (receipt + label printers) and restaurant.
    if (!printersLoaded && typeof window !== "undefined" && window.pos?.isElectron) {
      window.pos.printerAPI
        .listPrinters()
        .then(setPrinters)
        .finally(() => setPrintersLoaded(true));
    }
    if (businessType !== "restaurant") return;
    if (!tablesLoaded) {
      listRestaurantTables()
        .then(setTables)
        .finally(() => setTablesLoaded(true));
    }
    if (!stationsLoaded) {
      listKitchenStations()
        .then(setStations)
        .finally(() => setStationsLoaded(true));
    }
    if (!categoryStationsLoaded) {
      listCategoriesWithStations()
        .then(setCategoryStations)
        .finally(() => setCategoryStationsLoaded(true));
    }
    if (!productStationsLoaded) {
      listProductsWithStations()
        .then(setProductStations)
        .finally(() => setProductStationsLoaded(true));
    }
  }, [businessType, printersLoaded, tablesLoaded, stationsLoaded, categoryStationsLoaded, productStationsLoaded]);

  async function handleAddStation() {
    if (!newStationName.trim()) return;
    setStationBusy(true);
    try {
      await createKitchenStation(newStationName.trim());
      setNewStationName("");
      setStations(await listKitchenStations());
      toast.success("Station added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add station");
    } finally {
      setStationBusy(false);
    }
  }

  async function handleSetStationPrinter(stationId: string, printerName: string) {
    setStationBusy(true);
    try {
      await setKitchenStationPrinter(stationId, printerName === NO_PRINTER ? null : printerName);
      setStations(await listKitchenStations());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign printer");
    } finally {
      setStationBusy(false);
    }
  }

  async function handleToggleStation(station: KitchenStationRow) {
    setStationBusy(true);
    try {
      await setKitchenStationActive(station.id, !station.isActive);
      setStations(await listKitchenStations());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update station");
    } finally {
      setStationBusy(false);
    }
  }

  async function handleSetCategoryStation(categoryId: string, stationId: string) {
    try {
      await setCategoryStation(categoryId, stationId === NO_PRINTER ? null : stationId);
      setCategoryStations(await listCategoriesWithStations());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update category routing");
    }
  }

  async function handleSetProductStation(productId: string, stationId: string) {
    try {
      await setProductStation(productId, stationId === NO_PRINTER ? null : stationId);
      setProductStations(await listProductsWithStations());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update item routing");
    }
  }

  const filteredProductStations = productStations.filter((p) =>
    p.name.toLowerCase().includes(productSearch.trim().toLowerCase()),
  );

  async function handleAddTable() {
    if (!newTableName.trim()) return;
    setTableBusy(true);
    try {
      await createRestaurantTable(newTableName.trim());
      setNewTableName("");
      setTables(await listRestaurantTables());
      toast.success("Table added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add table");
    } finally {
      setTableBusy(false);
    }
  }

  async function handleToggleTable(table: RestaurantTableRow) {
    setTableBusy(true);
    try {
      await setRestaurantTableActive(table.id, !table.isActive);
      setTables(await listRestaurantTables());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update table");
    } finally {
      setTableBusy(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const input: BusinessSettingsInput = {
      businessName,
      logoUrl: settings.logoUrl,
      address: address || null,
      taxId: taxId || null,
      contactPhone: contactPhone || null,
      contactEmail: contactEmail || null,
      taxInclusivePricing: taxInclusive,
      receiptHeader: receiptHeader || null,
      receiptFooter: receiptFooter || null,
      currencyCode,
      currencySymbol,
      locale,
      costingMethod,
      businessType,
      receiptPrinterName: receiptPrinterName === NO_PRINTER ? null : receiptPrinterName,
      kotPrinterName: kotPrinterName === NO_PRINTER ? null : kotPrinterName,
      labelPrinterName: labelPrinterName === NO_PRINTER ? null : labelPrinterName,
      receiptTemplate,
      receiptPaperWidth,
      receiptFontSize,
      receiptShowLogo,
      receiptShowTaxId,
      receiptShowCashier,
      receiptShowBarcode,
      receiptAutoPrint,
    };
    startTransition(async () => {
      try {
        await updateBusinessSettings(input);
        toast.success("Settings saved");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save settings");
      }
    });
  }

  const liveReceiptStyle: ReceiptStyle = {
    template: receiptTemplate,
    paperWidth: receiptPaperWidth,
    fontSize: receiptFontSize,
    showLogo: receiptShowLogo,
    showTaxId: receiptShowTaxId,
    showCashier: receiptShowCashier,
    showBarcode: receiptShowBarcode,
  };

  const previewReceiptData = {
    ...SAMPLE_RECEIPT,
    business: {
      ...SAMPLE_RECEIPT.business,
      name: businessName || SAMPLE_RECEIPT.business.name,
      address: address || SAMPLE_RECEIPT.business.address,
      taxId: taxId || SAMPLE_RECEIPT.business.taxId,
      phone: contactPhone || SAMPLE_RECEIPT.business.phone,
      email: contactEmail || SAMPLE_RECEIPT.business.email,
      logoUrl: settings.logoUrl,
      header: receiptHeader || SAMPLE_RECEIPT.business.header,
      footer: receiptFooter || SAMPLE_RECEIPT.business.footer,
      currencySymbol: currencySymbol || SAMPLE_RECEIPT.business.currencySymbol,
    },
  };

  const printerOptions = (
    <>
      <SelectItem value={NO_PRINTER}>Not assigned</SelectItem>
      {printers.map((p) => (
        <SelectItem key={p.name} value={p.name}>
          {p.displayName || p.name}
        </SelectItem>
      ))}
    </>
  );

  const printerHint = !printersLoaded
    ? "Loading printers…"
    : printers.length === 0
      ? "No printers found (run the packaged app to see installed printers)."
      : `${printers.length} printer(s) available.`;

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <Tabs defaultValue="business">
        <TabsList>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="tax">Tax &amp; Currency</TabsTrigger>
          <TabsTrigger value="receipt">Receipt</TabsTrigger>
          <TabsTrigger value="costing">Costing Method</TabsTrigger>
          <TabsTrigger value="restaurant">Restaurant Mode</TabsTrigger>
          {businessType === "restaurant" && <TabsTrigger value="printers">Printers</TabsTrigger>}
          {businessType === "restaurant" && <TabsTrigger value="tables">Tables</TabsTrigger>}
        </TabsList>

        <TabsContent value="business">
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="businessName">Business name</Label>
                <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="taxId">Tax ID</Label>
                <Input id="taxId" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="contactPhone">Phone</Label>
                <Input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="contactEmail">Email</Label>
                <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax">
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="currencyCode">Currency code</Label>
                <Input id="currencyCode" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="currencySymbol">Currency symbol</Label>
                <Input id="currencySymbol" value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="locale">Locale</Label>
                <Input id="locale" value={locale} onChange={(e) => setLocale(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-3">
                <Checkbox checked={taxInclusive} onCheckedChange={(v) => setTaxInclusive(Boolean(v))} />
                Prices are tax-inclusive (tax is backed out of the sticker price instead of added on top)
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipt">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid gap-4">
              <Card>
                <CardContent className="grid gap-4 pt-6">
                  <Label>Template</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {RECEIPT_TEMPLATES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setReceiptTemplate(t.value)}
                        className={cn(
                          "rounded-lg border p-3 text-left transition",
                          receiptTemplate === t.value
                            ? "border-primary bg-primary/5 ring-2 ring-primary/40"
                            : "border-border hover:border-foreground/30",
                        )}
                      >
                        <p className="text-sm font-semibold">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.blurb}</p>
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Paper width</Label>
                      <Select
                        value={receiptPaperWidth}
                        onValueChange={(v) => v && setReceiptPaperWidth(v as ReceiptPaperWidth)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="80mm">80 mm (common)</SelectItem>
                          <SelectItem value="58mm">58 mm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Font size</Label>
                      <Select
                        value={receiptFontSize}
                        onValueChange={(v) => v && setReceiptFontSize(v as ReceiptFontSize)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Small</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="large">Large</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <label className="flex items-center justify-between gap-2 text-sm">
                      Show logo
                      <Switch checked={receiptShowLogo} onCheckedChange={setReceiptShowLogo} />
                    </label>
                    <label className="flex items-center justify-between gap-2 text-sm">
                      Show tax ID
                      <Switch checked={receiptShowTaxId} onCheckedChange={setReceiptShowTaxId} />
                    </label>
                    <label className="flex items-center justify-between gap-2 text-sm">
                      Show cashier name
                      <Switch checked={receiptShowCashier} onCheckedChange={setReceiptShowCashier} />
                    </label>
                    <label className="flex items-center justify-between gap-2 text-sm">
                      Show sale barcode (Detailed / Minimal)
                      <Switch checked={receiptShowBarcode} onCheckedChange={setReceiptShowBarcode} />
                    </label>
                    <label className="flex items-center justify-between gap-2 text-sm">
                      Auto-print receipt after each sale
                      <Switch checked={receiptAutoPrint} onCheckedChange={setReceiptAutoPrint} />
                    </label>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="receiptHeader">Header text</Label>
                    <Textarea
                      id="receiptHeader"
                      value={receiptHeader}
                      onChange={(e) => setReceiptHeader(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="receiptFooter">Footer text</Label>
                    <Textarea
                      id="receiptFooter"
                      value={receiptFooter}
                      onChange={(e) => setReceiptFooter(e.target.value)}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>Receipt printer</Label>
                    <Select
                      value={receiptPrinterName}
                      onValueChange={(v) => v && setReceiptPrinterName(v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>{printerOptions}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Barcode / label printer</Label>
                    <Select
                      value={labelPrinterName}
                      onValueChange={(v) => v && setLabelPrinterName(v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>{printerOptions}</SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    {printerHint} You can also pick a different printer for a single job at
                    print time.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="lg:sticky lg:top-4 lg:self-start">
              <CardContent className="pt-6">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Live preview — {receiptPaperWidth}
                </p>
                <div className="flex justify-center overflow-auto rounded-lg bg-muted/40 p-4">
                  <div className="shadow-lg">
                    <Receipt data={previewReceiptData} style={liveReceiptStyle} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="costing">
          <Card>
            <CardContent className="grid gap-4 pt-6">
              <div className="grid gap-1.5">
                <Label>Inventory valuation method</Label>
                <Select value={costingMethod} onValueChange={(v) => v && setCostingMethod(v as typeof costingMethod)}>
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weighted_average">Weighted Average Cost</SelectItem>
                    <SelectItem value="batch_fifo">Batch-wise (FIFO)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Applies to profit/margin reports going forward. Historical batch costs are always preserved,
                  so switching this is safe and doesn&apos;t rewrite past data.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restaurant">
          <Card>
            <CardContent className="grid gap-4 pt-6">
              <div className="grid gap-1.5">
                <Label>Business type</Label>
                <Select value={businessType} onValueChange={(v) => v && setBusinessType(v as typeof businessType)}>
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail (default checkout)</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Restaurant mode switches the POS terminal to an item-tile layout with categories and search,
                  adds Dine In / Take Away and table selection, holds orders open until served, and sends a
                  Kitchen Order Ticket to the kitchen printer separately from the customer bill.
                </p>
              </div>
              {businessType === "restaurant" && (
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                  <UtensilsCrossed className="size-5 shrink-0" />
                  Configure kitchen/receipt printers in the <span className="font-medium text-foreground">Printers</span> tab
                  and dining tables in the <span className="font-medium text-foreground">Tables</span> tab.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {businessType === "restaurant" && (
          <TabsContent value="printers">
            <Card>
              <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Receipt printer (customer bill)</Label>
                  <Select value={receiptPrinterName} onValueChange={(v) => v && setReceiptPrinterName(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PRINTER}>Not assigned</SelectItem>
                      {printers.map((p) => (
                        <SelectItem key={p.name} value={p.name}>
                          {p.displayName || p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Default KOT printer (fallback)</Label>
                  <Select value={kotPrinterName} onValueChange={(v) => v && setKotPrinterName(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PRINTER}>Not assigned</SelectItem>
                      {printers.map((p) => (
                        <SelectItem key={p.name} value={p.name}>
                          {p.displayName || p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  {!printersLoaded ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Printer className="size-5" /> Loading printers installed on this computer...
                    </p>
                  ) : printers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No printers found. Install/connect a printer in Windows first, then reopen this page.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {printers.length} printer{printers.length === 1 ? "" : "s"} found on this computer.
                      Printing uses whatever driver is installed in Windows for the selected printer.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardContent className="grid gap-4 pt-6">
                <div>
                  <Label>Kitchen stations</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add one station per physical kitchen printer — Kitchen, Kottu Station, Bar, and so on. Each
                    station gets its own printer. Categories not routed to a station print on the default KOT
                    printer above.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newStationName}
                    onChange={(e) => setNewStationName(e.target.value)}
                    placeholder="e.g. Bar"
                    className="max-w-56"
                  />
                  <Button type="button" variant="outline" disabled={stationBusy} onClick={handleAddStation}>
                    <Plus /> Add station
                  </Button>
                </div>
                {!stationsLoaded ? (
                  <p className="text-xs text-muted-foreground">Loading stations...</p>
                ) : stations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No stations yet. Add your kitchen printers above.</p>
                ) : (
                  <div className="grid gap-2">
                    {stations.map((station) => (
                      <div
                        key={station.id}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-2.5"
                      >
                        <Badge variant={station.isActive ? "secondary" : "outline"} className="min-w-24 justify-center">
                          {station.name}
                          {!station.isActive && " (inactive)"}
                        </Badge>
                        <Select
                          value={station.printerName ?? NO_PRINTER}
                          onValueChange={(v) => v && handleSetStationPrinter(station.id, v)}
                        >
                          <SelectTrigger className="h-8 w-56 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_PRINTER}>Not assigned</SelectItem>
                            {printers.map((p) => (
                              <SelectItem key={p.name} value={p.name}>
                                {p.displayName || p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto"
                          disabled={stationBusy}
                          onClick={() => handleToggleStation(station)}
                        >
                          {station.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardContent className="grid gap-4 pt-6">
                <div>
                  <Label>Category routing</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Which station each product category&apos;s items print to when sent to the kitchen.
                  </p>
                </div>
                {!categoryStationsLoaded ? (
                  <p className="text-xs text-muted-foreground">Loading categories...</p>
                ) : categoryStations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No categories yet. Add categories from the Products page first.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {categoryStations.map((category) => (
                      <div key={category.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5">
                        <span className="min-w-32 text-sm font-medium">{category.name}</span>
                        <Select
                          value={category.stationId ?? NO_PRINTER}
                          onValueChange={(v) => v && handleSetCategoryStation(category.id, v)}
                        >
                          <SelectTrigger className="h-8 w-56 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_PRINTER}>Default KOT printer</SelectItem>
                            {stations.map((station) => (
                              <SelectItem key={station.id} value={station.id}>
                                {station.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardContent className="grid gap-4 pt-6">
                <div>
                  <Label>Item routing</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Override the station for individual items — for when only some items in a category need a
                    KOT at a specific station (e.g. a few dishes from Food routed to Kottu Station instead of
                    Kitchen). Leave as category default for everything else.
                  </p>
                </div>
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search items..."
                  className="max-w-72"
                />
                {!productStationsLoaded ? (
                  <p className="text-xs text-muted-foreground">Loading items...</p>
                ) : filteredProductStations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No items match.</p>
                ) : (
                  <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
                    {filteredProductStations.map((product) => {
                      const categoryStationName = stations.find((s) => s.id === product.categoryStationId)?.name;
                      return (
                        <div key={product.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{product.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {product.categoryName ?? "No category"}
                              {product.stationId == null &&
                                ` · category default: ${categoryStationName ?? "Default KOT printer"}`}
                            </p>
                          </div>
                          <Select
                            value={product.stationId ?? NO_PRINTER}
                            onValueChange={(v) => v && handleSetProductStation(product.id, v)}
                          >
                            <SelectTrigger className="h-8 w-56 shrink-0 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_PRINTER}>Use category default</SelectItem>
                              {stations.map((station) => (
                                <SelectItem key={station.id} value={station.id}>
                                  {station.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {businessType === "restaurant" && (
          <TabsContent value="tables">
            <Card>
              <CardContent className="grid gap-4 pt-6">
                <div className="flex gap-2">
                  <Input
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="e.g. Table 1"
                    className="max-w-56"
                  />
                  <Button type="button" variant="outline" disabled={tableBusy} onClick={handleAddTable}>
                    <Plus /> Add table
                  </Button>
                </div>
                {!tablesLoaded ? (
                  <p className="text-xs text-muted-foreground">Loading tables...</p>
                ) : tables.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tables yet. Add your dining tables above.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tables.map((table) => (
                      <button
                        key={table.id}
                        type="button"
                        disabled={tableBusy}
                        onClick={() => handleToggleTable(table)}
                        title={table.isActive ? "Click to deactivate" : "Click to reactivate"}
                      >
                        <Badge variant={table.isActive ? "secondary" : "outline"}>
                          {table.name}
                          {!table.isActive && " (inactive)"}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
