import DashboardShell from '@/components/DashboardShell';

export const metadata = { title: 'Dashboard · Maverick by Dubuddy' };

export default function DashboardLayout({ children }) {
  return <DashboardShell>{children}</DashboardShell>;
}
