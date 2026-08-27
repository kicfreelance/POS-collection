import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth/rbac";
import { Button } from "@/components/ui/button";
import { BarcodeLabel } from "./barcode-label";

export default async function ProductLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const isPrint = (await searchParams).print === "1";
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "products.view")) {
    redirect("/");
  }

  const { rows } = await pool.query<{ name: string; selling_price: string; barcode: string | null }>(
    `SELECT name, selling_price, barcode FROM products WHERE id = $1`,
    [id],
  );
  const product = rows[0];
  if (!product) {
    notFound();
  }

  if (!product.barcode) {
    return (
      <div className="mx-auto w-full max-w-md px-10 py-10 text-center">
        <p className="mb-4 text-muted-foreground">
          This product has no barcode yet. Add one from the edit page first.
        </p>
        <Button render={<Link href={`/products/${id}/edit`} />}>Go to edit page</Button>
      </div>
    );
  }

  return (
    <BarcodeLabel
      productId={id}
      name={product.name}
      price={product.selling_price}
      barcode={product.barcode}
      print={isPrint}
    />
  );
}
