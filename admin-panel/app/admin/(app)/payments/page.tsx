import type { Metadata } from 'next';

import { PaymentTable } from '@/components/admin/PaymentTable';
import { RealtimeRefresh } from '@/components/admin/RealtimeRefresh';
import { FilterTabs, SearchInput } from '@/components/ui/Filters';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { listPayments } from '@/lib/services/payments';
import { first, parsePageParams } from '@/lib/utils/pagination';
import type { PaymentStatusFilter } from '@/types/payment';

export const metadata: Metadata = { title: 'Payments' };
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = first(params.q) ?? '';

  // Default view is the queue that needs a human, not the archive.
  const status = (first(params.status) as PaymentStatusFilter | undefined) ?? 'PROOF_RECEIVED';
  const page = parsePageParams(params);

  const payments = await listPayments({ search, status }, page);

  return (
    <div className="space-y-4">
      <RealtimeRefresh tables={['payments', 'orders']} pollMs={20000} />

      <PageHeader
        title="Payments"
        subtitle="A screenshot is never proof on its own — check the money arrived, then verify."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput placeholder="Order id or phone…" className="lg:max-w-sm" />
        <FilterTabs
          paramName="status"
          current={status}
          pathname="/admin/payments"
          searchParams={params}
          options={[
            { label: 'Needs verification', value: 'PROOF_RECEIVED' },
            { label: 'Awaiting payment', value: 'PENDING' },
            { label: 'Verified', value: 'VERIFIED' },
            { label: 'Rejected', value: 'REJECTED' },
            { label: 'All', value: 'ALL' },
          ]}
        />
      </div>

      <div className="card overflow-hidden">
        <PaymentTable payments={payments.rows} query={search} />
        <Pagination
          page={payments.page}
          pageCount={payments.pageCount}
          total={payments.total}
          pageSize={payments.pageSize}
          pathname="/admin/payments"
          searchParams={params}
        />
      </div>
    </div>
  );
}
