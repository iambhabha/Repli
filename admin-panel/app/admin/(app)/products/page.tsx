import type { Metadata } from 'next';

import { ProductTable } from '@/components/admin/ProductTable';
import { FilterTabs, SearchInput } from '@/components/ui/Filters';
import { PageHeader } from '@/components/ui/PageHeader';
import { listCategories } from '@/lib/services/categories';
import { listProducts, type ProductFilters } from '@/lib/services/products';
import { getLowStockThreshold } from '@/lib/services/settings';
import { first } from '@/lib/utils/pagination';

export const metadata: Metadata = { title: 'Products' };
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = first(params.q) ?? '';
  const status = (first(params.status) as ProductFilters['status']) ?? 'ALL';

  const [products, threshold, categories] = await Promise.all([
    listProducts({ search, status }),
    getLowStockThreshold(),
    listCategories(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        subtitle="What Repli offers, and what it charges. Changes apply to the next customer message."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search product or code…" className="sm:max-w-sm" />
        <FilterTabs
          paramName="status"
          current={status ?? 'ALL'}
          pathname="/admin/products"
          searchParams={params}
          options={[
            { label: 'All', value: 'ALL' },
            { label: 'Active', value: 'ACTIVE' },
            { label: 'Inactive', value: 'INACTIVE' },
          ]}
        />
      </div>

      <ProductTable products={products} threshold={threshold} categories={categories} />
    </div>
  );
}
