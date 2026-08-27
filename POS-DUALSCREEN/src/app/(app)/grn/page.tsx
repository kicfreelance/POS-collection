import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function GrnListPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "grn.manage")) {
    redirect("/");
  }

  const { rows: grns } = await pool.query<{
    id: string;
    grn_number: string;
    supplier_name: string;
    received_date: string;
    item_count: string;
    total_cost: string;
  }>(
    `SELECT g.id, g.grn_number, s.name AS supplier_name, g.received_date,
            COUNT(gi.id) AS item_count, COALESCE(SUM(gi.quantity * gi.cost_price), 0) AS total_cost
     FROM grns g
     JOIN suppliers s ON s.id = g.supplier_id
     LEFT JOIN grn_items gi ON gi.grn_id = g.id
     GROUP BY g.id, s.name
     ORDER BY g.created_at DESC`,
  );

  return (
    <div className="w-full px-10 py-10 2xl:px-16">
      <div className="mb-8 flex items-center justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Goods Received Notes</h1>
          <p className="text-sm text-muted-foreground">Receive stock from suppliers into batches.</p>
        </div>
        <Button render={<Link href="/grn/new" />}>
          <Plus /> New GRN
        </Button>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GRN #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grns.map((grn) => (
                <TableRow key={grn.id}>
                  <TableCell className="font-medium">
                    <Link href={`/grn/${grn.id}`} className="hover:underline">
                      {grn.grn_number}
                    </Link>
                  </TableCell>
                  <TableCell>{grn.supplier_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(grn.received_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{grn.item_count}</TableCell>
                  <TableCell>{Number(grn.total_cost).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {grns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No GRNs yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
