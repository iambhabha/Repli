import type { Metadata } from 'next';

import { RealtimeRefresh } from '@/components/admin/RealtimeRefresh';
import { StockTable } from '@/components/admin/StockTable';
import { FilterTabs, SearchInput } from '@/components/ui/Filters';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { listStock, type StockFilters } from '@/lib/services/stock';
import { first, parsePageParams } from '@/lib/utils/pagination';

export const metadata: Metadata = { title: 'Stock' };
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = first(params.q) ?? '';
  const level = (first(params.level) as StockFilters['level']) ?? 'ALL';
  const page = parsePageParams(params, 50);

  const stock = await listStock({ search, level }, page);

  return (
    <div className="space-y-4">
      <RealtimeRefresh tables={['product_variants']} pollMs={30000} />

      <PageHeader
        title="Stock"
        subtitle={`Low stock is ${stock.threshold} or fewer. Change that on the settings page.`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput placeholder="Product, colour, size or SKU…" className="sm:max-w-sm" />
        <FilterTabs
          paramName="level"
          current={level ?? 'ALL'}
          pathname="/admin/stock"
          searchParams={params}
          options={[
            { label: 'All', value: 'ALL' },
            { label: 'Low stock', value: 'LOW' },
            { label: 'Out of stock', value: 'OUT' },
            { label: 'In stock', value: 'IN' },
          ]}
        />
      </div>

      <div className="card overflow-hidden">
        <StockTable rows={stock.rows} threshold={stock.threshold} query={search} />
        <Pagination
          page={stock.page}
          pageCount={stock.pageCount}
          total={stock.total}
          pageSize={stock.pageSize}
          pathname="/admin/stock"
          searchParams={params}
        />
      </div>
    </div>
  );
}
