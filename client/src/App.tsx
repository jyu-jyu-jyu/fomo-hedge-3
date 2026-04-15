import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

// Strip query params from hash path so routes like /#/add?connected=eventbrite still match /add
function useHashLocationStripped(): [string, (to: string) => void] {
  const [location, navigate] = useHashLocation();
  const stripped = location.split("?")[0];
  return [stripped, navigate];
}
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

import MyTickets from "./pages/MyTickets";
import Marketplace from "./pages/Marketplace";
import AddTicket from "./pages/AddTicket";
import NotFound from "./pages/not-found";

import {
  Ticket, ShoppingBag, Plus, Menu, X, Moon, Sun
} from "lucide-react";
import { useState, useEffect } from "react";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [location] = useLocation();
  const isActive = location === href || (href !== "/" && location.startsWith(href));
  return (
    <Link href={href}>
      <span className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}>
        {children}
      </span>
    </Link>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/">
            <span className="flex items-center gap-2 cursor-pointer">
              <svg viewBox="0 0 32 32" width="28" height="28" fill="none" aria-label="FomoHedge logo">
                <rect width="32" height="32" rx="8" fill="hsl(350 72% 35%)" />
                <polyline points="4,24 10,16 16,19 28,8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="23,8 28,8 28,13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-bold text-base tracking-tight">FomoHedge</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink href="/"><Plus size={15} />Add Ticket</NavLink>
            <NavLink href="/my-tickets"><Ticket size={15} />My Tickets</NavLink>
            <NavLink href="/marketplace"><ShoppingBag size={15} />Marketplace</NavLink>
          </nav>

          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            <button
              onClick={() => setDark(d => !d)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Demo badge */}
            <span className="hidden md:inline text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
              Demo: Alex Chen
            </span>

            {/* Mobile menu */}
            <button
              className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-muted"
              onClick={() => setMobileOpen(o => !o)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-card px-4 py-3 flex flex-col gap-1">
            <NavLink href="/"><Plus size={15} />Add Ticket</NavLink>
            <NavLink href="/my-tickets"><Ticket size={15} />My Tickets</NavLink>
            <NavLink href="/marketplace"><ShoppingBag size={15} />Marketplace</NavLink>
          </div>
        )}
      </header>

      {/* Page */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-border text-center text-xs text-muted-foreground py-4">
        FomoHedge · Buy with FOMO. Exit with confidence. · Not affiliated with Harvard University
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocationStripped}>
        <Layout>
          <Switch>
            <Route path="/" component={AddTicket} />
            <Route path="/add" component={AddTicket} />
            <Route path="/my-tickets" component={MyTickets} />
            <Route path="/marketplace" component={Marketplace} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
