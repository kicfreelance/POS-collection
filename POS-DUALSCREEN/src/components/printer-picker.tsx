"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PrinterInfo, PrintResult } from "@/types/electron";

const DEFAULT_PRINTER = "__default__";
const STORAGE_KEY = "pos.printerPicker";

function readSaved(storageKey: string): string {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, string>;
    return saved[storageKey] || DEFAULT_PRINTER;
  } catch {
    return DEFAULT_PRINTER;
  }
}

/**
 * A "Print X" button with a caret that opens a printer chooser. The chosen
 * device is passed to `onPrint` (null = use the default configured in Settings).
 * The last choice is remembered per `storageKey`.
 */
export function PrinterPicker({
  label,
  storageKey = "receipt",
  onPrint,
  size = "default",
  variant = "default",
}: {
  label: string;
  storageKey?: string;
  onPrint: (deviceName: string | null) => Promise<PrintResult>;
  size?: "default" | "sm";
  variant?: "default" | "outline";
}) {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selected, setSelected] = useState<string>(DEFAULT_PRINTER);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.pos?.isElectron) return;
    let cancelled = false;
    window.pos.printerAPI
      .listPrinters()
      .then((list) => {
        if (cancelled) return;
        setPrinters(list);
        setSelected(readSaved(storageKey));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  function choose(value: string) {
    setSelected(value);
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, string>;
      saved[storageKey] = value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
  }

  async function doPrint() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await onPrint(selected === DEFAULT_PRINTER ? null : selected);
      if (res?.success) toast.success(`${label} sent`);
      else toast.error(`${label} failed: ${res?.error ?? "unknown error"}`);
    } catch (e) {
      toast.error(`${label} failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const selectedName =
    selected === DEFAULT_PRINTER
      ? "Default printer (Settings)"
      : printers.find((p) => p.name === selected)?.displayName || selected;

  return (
    <div className="inline-flex">
      <Button
        type="button"
        size={size}
        variant={variant}
        className="rounded-r-none"
        onClick={doPrint}
        disabled={busy}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Printer />}
        {label}
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              size={size}
              variant={variant}
              className="rounded-l-none border-l border-l-black/20 px-2"
              aria-label="Choose printer"
            >
              <ChevronDown />
            </Button>
          }
        />
        <PopoverContent className="w-72 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Printer for this job</p>
          <Select value={selected} onValueChange={(v) => v && choose(v)}>
            <SelectTrigger className="w-full">
              <SelectValue>{selectedName}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_PRINTER}>Default printer (Settings)</SelectItem>
              {printers.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.displayName || p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {printers.length === 0 && (
            <p className="text-xs text-muted-foreground">No printers detected.</p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
