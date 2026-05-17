import { redirect } from "next/navigation";

type OrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const resolved = await params;
  const orderId = Number(resolved.id);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    redirect("/orders");
  }
  redirect(`/orders?single_order_view=1&edit_order_id=${orderId}`);
}
