import { redirect } from 'next/navigation';

/** The panel has no public landing page - everything starts at the dashboard. */
export default function Home() {
  redirect('/admin/dashboard');
}
