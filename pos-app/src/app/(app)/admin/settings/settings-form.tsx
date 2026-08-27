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
    if (businessType !== "restaurant") return;
    if (!printersLoaded && typeof window !== "undefined" && window.pos?.isElectron) {
      window.pos.printerAPI
        .listPrinters()
        .then(setPrinters)
        .finally(() => setPrintersLoaded(true));
    }
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
          <Card>
            <CardContent className="grid gap-4 pt-6">
              <div className="grid gap-1.5">
                <Label htmlFor="receiptHeader">Receipt header text</Label>
                <Textarea id="receiptHeader" value={receiptHeader} onChange={(e) => setReceiptHeader(e.target.value)} rows={2} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="receiptFooter">Receipt footer text</Label>
                <Textarea id="receiptFooter" value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} rows={2} />
              </div>
            </CardContent>
          </Card>
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
                      <Printer className="size-4" /> Loading printers installed on this computer...
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
