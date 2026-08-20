import type { Metadata } from 'next';
import { Download } from 'lucide-react';

import { CustomerTable } from '@/components/admin/CustomerTable';
import { FilterTabs, SearchInput } from '@/components/ui/Filters';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { listCustomers } from '@/lib/services/customers';
import { first, parsePageParams } from '@/lib/utils/pagination';
import type { CustomerFilters } from '@/lib/services/customers';
import type { CustomerModeFilter } from '@/types/customer';

export const metadata: Metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = first(params.q) ?? '';
  const mode = (first(params.mode) as CustomerModeFilter | undefined) ?? 'ALL';
  const sort = (first(params.sort) as CustomerFilters['sort']) ?? 'recent';
  const page = parsePageParams(params);

  const customers = await listCustomers({ search, mode, sort }, page);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        subtitle={`${customers.total} ${customers.total === 1 ? 'person has' : 'people have'} messaged Repli.`}
        actions={
          /**
           * A plain link, not a fetch: the browser handles the download, so
           * the file arrives even if the page is busy, and it works the same
           * on a phone. The export always contains everyone - filters on
           * this page do not narrow it, because a customer list you keep is
           * only useful when it is the whole list.
           */
          <a href="/api/export/customers" className="btn btn-secondary" download>
            <Download className="size-4" />
            Excel
          </a>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search name, phone or city…" className="sm:max-w-sm" />
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <FilterTabs
            paramName="mode"
            current={mode}
            pathname="/admin/customers"
            searchParams={params}
            options={[
              { label: 'All', value: 'ALL' },
              { label: 'Bot', value: 'BOT' },
              { label: 'Human', value: 'HUMAN' },
            ]}
          />
          <FilterTabs
            paramName="sort"
            current={sort ?? 'recent'}
            pathname="/admin/customers"
            searchParams={params}
            options={[
              { label: 'Newest', value: 'recent' },
              { label: 'Name', value: 'name' },
              { label: 'Top spend', value: 'spent' },
              { label: 'Most orders', value: 'orders' },
            ]}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <CustomerTable customers={customers.rows} query={search} />
        <Pagination
          page={customers.page}
          pageCount={customers.pageCount}
          total={customers.total}
          pageSize={customers.pageSize}
          pathname="/admin/customers"
          searchParams={params}
        />
      </div>
    </div>
  );
}
