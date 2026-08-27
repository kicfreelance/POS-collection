import { notFound, redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReturnBatchDialog } from "./return-batch-dialog";

export default async function GrnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "grn.manage")) {
    redirect("/");
  }

  const { rows: grnRows } = await pool.query<{
    id: string;
    grn_number: string;
    supplier_name: string;
    received_date: string;
    notes: string | null;
  }>(
    `SELECT g.id, g.grn_number, s.name AS supplier_name, g.received_date, g.notes
     FROM grns g JOIN suppliers s ON s.id = g.supplier_id WHERE g.id = $1`,
    [id],
  );
  const grn = grnRows[0];
  if (!grn) notFound();

  const canReturn = hasPermission(user, "grn.return");

  const { rows: items } = await pool.query<{
    product_name: string;
    batch_id: string;
    batch_number: string;
    quantity: string;
    cost_price: string;
    quantity_remaining: string;
    base_unit: string;
  }>(
    `SELECT p.name AS product_name, b.id AS batch_id, b.batch_number, gi.quantity, gi.cost_price,
            b.quantity_remaining, p.base_unit
     FROM grn_items gi
     JOIN products p ON p.id = gi.product_id
     JOIN batches b ON b.id = gi.batch_id
     WHERE gi.grn_id = $1
     ORDER BY gi.created_at`,
    [id],
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-10 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">{grn.grn_number}</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {grn.supplier_name} &middot; {new Date(grn.received_date).toLocaleDateString()}
        {grn.notes ? ` — ${grn.notes}` : ""}
      </p>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Qty received</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Remaining</TableHead>
                {canReturn && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.batch_id}>
                  <TableCell className="font-medium">{item.product_name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.batch_number}</TableCell>
                  <TableCell>
                    {Number(item.quantity).toFixed(3)} {item.base_unit}
                  </TableCell>
                  <TableCell>{Number(item.cost_price).toFixed(2)}</TableCell>
                  <TableCell>
                    {Number(item.quantity_remaining).toFixed(3)} {item.base_unit}
                  </TableCell>
                  {canReturn && (
                    <TableCell>
                      <ReturnBatchDialog
                        batchId={item.batch_id}
                        productName={item.product_name}
                        maxQuantity={Number(item.quantity_remaining)}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
