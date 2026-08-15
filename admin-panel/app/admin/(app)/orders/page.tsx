import type { Metadata } from 'next';

import { OrderTable } from '@/components/admin/OrderTable';
import { RealtimeRefresh } from '@/components/admin/RealtimeRefresh';
import { FilterTabs, SearchInput } from '@/components/ui/Filters';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { listOrders, type OrderFilters } from '@/lib/services/orders';
import { first, parsePageParams } from '@/lib/utils/pagination';
import type { OrderStatusFilter } from '@/types/order';

export const metadata: Metadata = { title: 'Orders' };
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = first(params.q) ?? '';
  const status = (first(params.status) as OrderStatusFilter | undefined) ?? 'ALL';
  const sort = (first(params.sort) as OrderFilters['sort']) ?? 'recent';
  const page = parsePageParams(params);

  const orders = await listOrders({ search, status, sort }, page);

  return (
    <div className="space-y-4">
      <RealtimeRefresh tables={['orders', 'payments']} pollMs={30000} />

      <PageHeader title="Orders" subtitle={`${orders.total} orders in total.`} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput placeholder="Order id, phone or name…" className="lg:max-w-sm" />
        <FilterTabs
          paramName="status"
          current={status}
          pathname="/admin/orders"
          searchParams={params}
          options={[
            { label: 'All', value: 'ALL' },
            { label: 'Pending Payment', value: 'PENDING_PAYMENT' },
            { label: 'Payment Verifying', value: 'PAYMENT_VERIFYING' },
            { label: 'Confirmed', value: 'CONFIRMED' },
            { label: 'Rejected', value: 'PAYMENT_FAILED' },
            { label: 'Cancelled', value: 'CANCELLED' },
          ]}
        />
      </div>

      <div className="card overflow-hidden">
        <OrderTable orders={orders.rows} query={search} />
        <Pagination
          page={orders.page}
          pageCount={orders.pageCount}
          total={orders.total}
          pageSize={orders.pageSize}
          pathname="/admin/orders"
          searchParams={params}
        />
      </div>
    </div>
  );
}
