"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderCog, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCategory, deleteCategory } from "./actions";

export interface CategoryRow {
  id: string;
  name: string;
}

export function CategoriesDialog({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createCategory(name);
        toast.success(`Category "${name}" added`);
        setName("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add category");
      }
    });
  }

  function handleDelete(id: string, categoryName: string) {
    startTransition(async () => {
      try {
        await deleteCategory(id);
        toast.success(`Category "${categoryName}" deleted`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete category");
      }
    });
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline">
            <FolderCog />
            Categories
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>Used for filtering and organizing the catalog.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New category name"
          />
          <Button type="submit" disabled={isPending || !name.trim()}>
            Add
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid max-h-64 gap-1 overflow-y-auto">
          {categories.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">No categories yet.</p>
          )}
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
            >
              {category.name}
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                onClick={() => handleDelete(category.id, category.name)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
