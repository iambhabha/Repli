import type { Metadata } from 'next';

import { CategoryTable } from '@/components/admin/CategoryTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { listCategories } from '@/lib/services/categories';

export const metadata: Metadata = { title: 'Categories' };
export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  // Hidden ones are shown here on purpose - this is where you turn one back on.
  const categories = await listCategories(true);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Categories"
        subtitle="The “what are you looking for?” menu. A category is only offered to a customer when something in it is in stock."
      />

      <CategoryTable categories={categories} />
    </div>
  );
}
