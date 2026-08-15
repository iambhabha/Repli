import type { Metadata } from 'next';

import { BypassTable } from '@/components/admin/BypassTable';
import { SearchInput } from '@/components/ui/Filters';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { listBypass } from '@/lib/services/bypass';
import { first, parsePageParams } from '@/lib/utils/pagination';

export const metadata: Metadata = { title: 'Bypass' };
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function BypassPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = first(params.q) ?? '';
  const page = parsePageParams(params);

  const numbers = await listBypass({ search }, page);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bypass Numbers"
        subtitle="Numbers Repli ignores completely — personal chats never get a sales menu."
      />

      <SearchInput placeholder="Search name or phone…" className="sm:max-w-sm" />

      <BypassTable numbers={numbers.rows} />

      {numbers.pageCount > 1 ? (
        <div className="card">
          <Pagination
            page={numbers.page}
            pageCount={numbers.pageCount}
            total={numbers.total}
            pageSize={numbers.pageSize}
            pathname="/admin/bypass"
            searchParams={params}
          />
        </div>
      ) : null}
    </div>
  );
}
