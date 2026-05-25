import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Presentation, LayoutDashboard, Settings } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Sidebar */}
      <aside className="w-64 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hidden md:flex flex-col">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
            <Presentation className="h-6 w-6 text-blue-600" />
            <span>SlideFlow</span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-md bg-neutral-100 dark:bg-neutral-800 text-sm font-medium">
            <LayoutDashboard className="h-4 w-4" />
            Presentations
          </Link>
          <Link href="/dashboard/settings" className="flex items-center gap-3 px-3 py-2 rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm font-medium transition-colors">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </nav>
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
          <UserButton afterSignOutUrl="/" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">Account</span>
            <span className="text-xs text-neutral-500">Manage profile</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
            <Presentation className="h-5 w-5 text-blue-600" />
            SlideFlow
          </Link>
          <UserButton afterSignOutUrl="/" />
        </header>
        
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
