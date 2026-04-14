import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Ticket, ChevronDown, ChevronUp,
  Tag, Brain, Calendar, DollarSign, X, Plus, CheckCircle2, Users, Send, Mail,
} from "lucide-react";

type TicketWithConflicts = {
  id: number;
  eventName: string;
  eventDate: string;
  eventType: string;
  platform: string;
  pricePaid: number;
  userLikelihood: number;
  aiLikelihood: number | null;
  aiReason: string | null;
  isListed: number;
  askingPrice: number | null;
  conflicts: Array<{ id: number; conflictDescription: string; dismissed: number }>;
};

type Transaction = {
  id: number;
  ticketId: number;
  buyerName: string;
  buyerEmail: string;
  status: string;
  createdAt: string;
};

type CurrentUser = {
  id: number;
  name: string;
  email: string;
  hbsEmail?: string | null;
  classYear?: number | null;
};

// ── HBS Email Dialog ────────────────────────────────────────────────────────
function HbsEmailDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [hbsEmail, setHbsEmail] = useState("");
  const [error, setError] = useState("");

  const saveMutation = useMutation({
    mutationFn: (email: string) => apiRequest("PATCH", "/api/me", { hbsEmail: email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({ title: "HBS email saved!", description: "You can now list tickets for sale." });
      onOpenChange(false);
      onSaved();
    },
    onError: async (e: any) => {
      const data = await e.response?.json?.().catch(() => null);
      setError(data?.error || "Invalid HBS email address.");
    },
  });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError("");
    const match = hbsEmail.match(/^[^@]+@mba(\d{4})\.hbs\.edu$/i);
    if (!match) {
      setError("Must be a valid HBS email (e.g. jsmith@mba2027.hbs.edu)");
      return;
    }
    saveMutation.mutate(hbsEmail);
  };

  // Extract class year preview from domain e.g. mba2027.hbs.edu → 2027
  const yearMatch = hbsEmail.match(/^[^@]+@mba(\d{4})\.hbs\.edu$/i);
  const yearPreview = yearMatch ? `Class of ${yearMatch[1]}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter your HBS email</DialogTitle>
          <DialogDescription>
            We need your HBS email to list your ticket so buyers can verify you're part of the community.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hbs-email">HBS email address</Label>
            <Input
              id="hbs-email"
              type="email"
              value={hbsEmail}
              onChange={e => { setHbsEmail(e.target.value); setError(""); }}
              placeholder="jsmith@mba2027.hbs.edu"
              required
            />
            {yearPreview && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 size={11} className="text-green-500" />
                Detected: <strong>{yearPreview}</strong>
              </p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground">
            <Mail size={11} className="inline mr-1" />
            Your email will be partially masked in the marketplace for privacy.
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              Save & continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Listing Price Dialog ────────────────────────────────────────────────────
function ListingPriceDialog({
  ticket,
  open,
  onOpenChange,
  onConfirm,
}: {
  ticket: TicketWithConflicts;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (price: number) => void;
}) {
  const suggested = Math.round(ticket.pricePaid * 0.85);
  const [priceStr, setPriceStr] = useState(String(suggested));

  // Fetch marketplace to compare with other listings for same event
  const { data: marketEvents } = useQuery<any[]>({
    queryKey: ["/api/marketplace"],
    enabled: open,
  });

  const price = parseFloat(priceStr) || 0;
  const pricePaid = ticket.pricePaid;

  const discountPct = pricePaid > 0 ? Math.round((1 - price / pricePaid) * 100) : 0;
  const discountLabel =
    discountPct > 0 ? `${discountPct}% below what you paid ($${pricePaid})`
    : discountPct < 0 ? `${Math.abs(discountPct)}% above what you paid ($${pricePaid})`
    : `Same as what you paid ($${pricePaid})`;

  // Find other listings for this event
  const otherListings = marketEvents
    ?.find((e: any) => e.eventName === ticket.eventName)
    ?.topSellers?.filter((s: any) => s.askingPrice != null) ?? [];

  const otherPrices: number[] = otherListings.map((s: any) => s.askingPrice as number);
  const avgOther = otherPrices.length > 0
    ? Math.round(otherPrices.reduce((a: number, b: number) => a + b, 0) / otherPrices.length)
    : null;
  const minOther = otherPrices.length > 0 ? Math.min(...otherPrices) : null;

  let comparisonLabel: string | null = null;
  if (avgOther !== null) {
    if (price < (minOther ?? avgOther)) comparisonLabel = `Lowest price listed — other sellers ask $${minOther}–$${Math.max(...otherPrices)}`;
    else if (price > avgOther) comparisonLabel = `Above average — other listings average $${avgOther}`;
    else comparisonLabel = `Around the average — other listings average $${avgOther}`;
  }

  const handleConfirm = () => {
    if (price > 0) { onConfirm(price); onOpenChange(false); }
  };

  // Reset price when dialog opens
  const handleOpen = (v: boolean) => {
    if (v) setPriceStr(String(suggested));
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set your listing price</DialogTitle>
          <DialogDescription>
            {ticket.eventName} · {new Date(ticket.eventDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="listing-price">Asking price (USD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <Input
                id="listing-price"
                type="number"
                min={0}
                step={1}
                value={priceStr}
                onChange={e => setPriceStr(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          {/* Discount from original */}
          {pricePaid > 0 && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
              discountPct > 0 ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
              : discountPct < 0 ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
              : "bg-muted border-border text-muted-foreground"
            }`}>
              <DollarSign size={14} className="shrink-0" />
              {discountLabel}
            </div>
          )}

          {/* Comparison with other listings */}
          {comparisonLabel && (
            <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-muted/50 border border-border text-muted-foreground">
              <Tag size={14} className="shrink-0" />
              {comparisonLabel}
            </div>
          )}
          {otherListings.length === 0 && (
            <div className="text-xs text-muted-foreground px-1">No other listings found for this event — you'd be the first seller.</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={price <= 0}>
            List at ${price > 0 ? price : "—"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function likelihoodClass(score: number) {
  if (score >= 65) return "likelihood-high";
  if (score >= 40) return "likelihood-medium";
  return "likelihood-low";
}

function likelihoodLabel(score: number) {
  if (score >= 65) return "Likely going";
  if (score >= 40) return "Uncertain";
  return "At risk of bailing";
}

function platformBadge(platform: string) {
  const map: Record<string, string> = {
    eventbrite: "Eventbrite", partiful: "Partiful", luma: "Luma",
    email: "Email import", screenshot: "Screenshot", manual: "Manual", outlook: "Outlook",
  };
  return map[platform] || platform;
}

function eventTypeBadge(type: string) {
  const colors: Record<string, string> = {
    party: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    trek: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    conference: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
    career: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  };
  return colors[type] || colors.other;
}

function TicketCard({ ticket, isPast, transactions, currentUser, onNeedHbsEmail, sellThreshold }: {
  ticket: TicketWithConflicts;
  isPast: boolean;
  transactions: Transaction[];
  currentUser: CurrentUser | undefined;
  onNeedHbsEmail: (cb: () => void) => void;
  sellThreshold: number;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [likelihood, setLikelihood] = useState(ticket.userLikelihood);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);

  const activeConflicts = ticket.conflicts.filter(c => !c.dismissed);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<any>) => apiRequest("PATCH", `/api/tickets/${ticket.id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tickets"] }),
  });

  const markTransferredMutation = useMutation({
    mutationFn: (transactionId: number) =>
      apiRequest("PATCH", `/api/transactions/${transactionId}/status`, { status: "ticket_transferred" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/transactions/my-listings"] }),
  });

  const dismissConflict = useMutation({
    mutationFn: (conflictId: number) => apiRequest("POST", `/api/conflicts/${conflictId}/dismiss`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tickets"] }),
  });

  const doUnlist = () => {
    updateMutation.mutate({ isListed: 0, askingPrice: null });
    toast({ title: "Listing removed", description: "Your ticket is no longer visible to buyers." });
  };

  const doList = (price: number) => {
    updateMutation.mutate({ isListed: 1, askingPrice: price });
    toast({ title: "Ticket listed for sale", description: `Listed at $${price} — visible to buyers in the marketplace.` });
  };

  const openPriceDialog = () => setPriceDialogOpen(true);

  const toggleList = () => {
    if (ticket.isListed === 1) {
      doUnlist();
    } else if (!currentUser?.hbsEmail) {
      onNeedHbsEmail(openPriceDialog);
    } else {
      openPriceDialog();
    }
  };

  const aiScore = ticket.aiLikelihood ?? ticket.userLikelihood;
  const displayDate = new Date(ticket.eventDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const daysUntil = Math.ceil((new Date(ticket.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const belowThreshold = !isPast && ticket.isListed === 0 && aiScore < sellThreshold;

  return (
    <>
    <Card className={`ticket-card border-border bg-card overflow-hidden ${isPast ? "opacity-80" : ""} ${belowThreshold ? "ring-2 ring-orange-400 dark:ring-orange-500" : ""}`} data-testid={`ticket-card-${ticket.id}`}>
      {/* Sell suggestion banner — shown when below threshold */}
      {belowThreshold && (
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
          <Tag size={13} className="text-orange-600 dark:text-orange-400 shrink-0" />
          <p className="text-xs text-orange-800 dark:text-orange-300 flex-1">
            AI score ({aiScore}%) is below your sell threshold — consider listing this ticket.
          </p>
        </div>
      )}
      {/* Conflict banner — only for upcoming */}
      {!isPast && activeConflicts.map(c => (
        <div key={c.id} className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300 flex-1">{c.conflictDescription}</p>
          <button
            onClick={() => dismissConflict.mutate(c.id)}
            className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 shrink-0"
            aria-label="Dismiss conflict"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base leading-tight truncate" data-testid="event-name">{ticket.eventName}</h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${eventTypeBadge(ticket.eventType)}`}>
                {ticket.eventType}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar size={11} />{displayDate}
                {!isPast && daysUntil > 0 && <span className="text-muted-foreground/70">· {daysUntil}d away</span>}
              </span>
              <span className="text-xs text-muted-foreground">{platformBadge(ticket.platform)}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-bold text-base">{ticket.pricePaid === 0 ? "Free" : `$${ticket.pricePaid}`}</div>
            {ticket.pricePaid > 0 && <div className="text-xs text-muted-foreground">paid</div>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {isPast ? (
          /* Past event — just show attended badge */
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 size={13} className="text-green-500" />
            Event has passed
          </div>
        ) : (
          <>
            {/* Likelihood section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Your likelihood of going</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${likelihoodClass(aiScore)}`}>
                    <Brain size={10} /> AI: {aiScore}%
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${likelihoodClass(likelihood)}`}>
                    You: {likelihood}%
                  </span>
                </div>
              </div>
              <Slider
                data-testid="likelihood-slider"
                min={0} max={100} step={5}
                value={[likelihood]}
                onValueChange={([v]) => setLikelihood(v)}
                onValueCommit={([v]) => updateMutation.mutate({ userLikelihood: v })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Definitely bailing</span>
                <span className={`font-medium ${likelihoodClass(likelihood)}`}>{likelihoodLabel(likelihood)}</span>
                <span>Definitely going</span>
              </div>
            </div>

            {/* AI reason expandable */}
            {ticket.aiReason && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="w-full text-left text-xs text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors"
                data-testid="ai-reason-toggle"
              >
                <Brain size={11} />
                {expanded ? "Hide AI reasoning" : "Why did AI suggest this score?"}
                {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            )}
            {expanded && ticket.aiReason && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 border border-border">
                {ticket.aiReason}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant={ticket.isListed ? "outline" : "default"}
                size="sm"
                onClick={toggleList}
                disabled={updateMutation.isPending}
                data-testid="list-toggle"
                className="text-xs"
              >
                <Tag size={13} className="mr-1" />
                {ticket.isListed ? `Listed · $${ticket.askingPrice}` : "List for Sale"}
              </Button>
              {ticket.isListed === 1 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign size={11} />Showing in marketplace
                </span>
              )}
            </div>

            {/* Buyer interest — only shown when listed */}
            {ticket.isListed === 1 && transactions.length > 0 && (
              <div className="pt-1 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Users size={11} />
                  {transactions.length} interested buyer{transactions.length !== 1 ? "s" : ""}
                </div>
                {transactions.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 border border-border px-3 py-2">
                    <div>
                      <div className="text-xs font-medium">{t.buyerName}</div>
                      <div className="text-xs text-muted-foreground">{t.buyerEmail}</div>
                      <div className="text-xs text-muted-foreground capitalize">Status: {t.status.replace(/_/g, " ")}</div>
                    </div>
                    {t.status === "interested" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs shrink-0"
                        disabled={markTransferredMutation.isPending}
                        onClick={() => markTransferredMutation.mutate(t.id)}
                      >
                        <Send size={11} className="mr-1" />
                        Mark transferred
                      </Button>
                    )}
                    {t.status === "ticket_transferred" && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 shrink-0">
                        <CheckCircle2 size={11} />Ticket sent
                      </span>
                    )}
                    {t.status === "payment_done" && (
                      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 shrink-0">
                        <CheckCircle2 size={11} />Paid
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>

    <ListingPriceDialog
      ticket={ticket}
      open={priceDialogOpen}
      onOpenChange={setPriceDialogOpen}
      onConfirm={doList}
    />
    </>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 border border-dashed border-border rounded-xl">
      <Ticket size={36} className="mx-auto text-muted-foreground/50 mb-3" />
      <p className="font-medium">No tickets yet</p>
      <p className="text-sm text-muted-foreground mt-1">Add your first event to get started</p>
      <Link href="/add">
        <Button className="mt-4" size="sm">
          <Plus size={14} className="mr-1.5" />Add your first ticket
        </Button>
      </Link>
    </div>
  );
}

export default function MyTickets() {
  const { data: tickets, isLoading } = useQuery<TicketWithConflicts[]>({
    queryKey: ["/api/tickets"],
  });

  const { data: myTransactions } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions/my-listings"],
  });

  const { data: currentUser } = useQuery<CurrentUser>({
    queryKey: ["/api/me"],
  });

  // Sell threshold state
  const [sellThreshold, setSellThreshold] = useState(40);

  // HBS email dialog state
  const [hbsDialogOpen, setHbsDialogOpen] = useState(false);
  const [pendingListCallback, setPendingListCallback] = useState<(() => void) | null>(null);

  const requestHbsEmail = (callback: () => void) => {
    setPendingListCallback(() => callback);
    setHbsDialogOpen(true);
  };

  const onHbsEmailSaved = () => {
    if (pendingListCallback) {
      pendingListCallback();
      setPendingListCallback(null);
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const upcoming = tickets?.filter(t => t.eventDate >= today) ?? [];
  const past = tickets?.filter(t => t.eventDate < today) ?? [];

  const activeConflictCount = upcoming.reduce((sum, t) => sum + t.conflicts.filter(c => !c.dismissed).length, 0);
  const listedCount = upcoming.filter(t => t.isListed).length;
  const belowThresholdCount = upcoming.filter(t => {
    const score = t.aiLikelihood ?? t.userLikelihood;
    return t.isListed === 0 && score < sellThreshold;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">My Tickets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track your events and manage resale likelihood
          </p>
        </div>
        <Link href="/add">
          <Button size="sm" data-testid="add-ticket-btn">
            <Plus size={15} className="mr-1" />Add Ticket
          </Button>
        </Link>
      </div>

      {/* Stats row — upcoming only */}
      {upcoming.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{upcoming.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Upcoming</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold ${activeConflictCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
              {activeConflictCount}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {activeConflictCount === 1 ? "Conflict" : "Conflicts"}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">{listedCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Listed for sale</div>
          </div>
        </div>
      )}

      {/* Conflict summary */}
      {activeConflictCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
              {activeConflictCount} scheduling conflict{activeConflictCount !== 1 ? "s" : ""} detected
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Your AI assistant flagged potential issues — review them below.
            </p>
          </div>
        </div>
      )}

      {/* Sell threshold slider */}
      {upcoming.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-muted-foreground" />
              <span className="text-sm font-medium">Find me a buyer if I drop below</span>
            </div>
            <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${sellThreshold > 0 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : "bg-muted text-muted-foreground"}`}>
              {sellThreshold}%
            </span>
          </div>
          <Slider
            min={0} max={100} step={5}
            value={[sellThreshold]}
            onValueChange={([v]) => setSellThreshold(v)}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Off</span>
            <span>
              {belowThresholdCount > 0
                ? <span className="text-orange-600 dark:text-orange-400 font-medium">{belowThresholdCount} ticket{belowThresholdCount !== 1 ? "s" : ""} below threshold</span>
                : "No tickets below threshold"}
            </span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-44 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="upcoming">
              Upcoming {upcoming.length > 0 && <span className="ml-1.5 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{upcoming.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="past">
              Past {past.length > 0 && <span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{past.length}</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4">
            {upcoming.length > 0 ? (
              <div className="space-y-3">
                {upcoming.map(t => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    isPast={false}
                    transactions={(myTransactions ?? []).filter(tx => tx.ticketId === t.id)}
                    currentUser={currentUser}
                    onNeedHbsEmail={requestHbsEmail}
                    sellThreshold={sellThreshold}
                  />
                ))}
              </div>
            ) : <EmptyState />}
          </TabsContent>

          <TabsContent value="past" className="mt-4">
            {past.length > 0 ? (
              <div className="space-y-3">
                {past.map(t => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    isPast={true}
                    transactions={(myTransactions ?? []).filter(tx => tx.ticketId === t.id)}
                    currentUser={currentUser}
                    onNeedHbsEmail={requestHbsEmail}
                    sellThreshold={sellThreshold}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No past events yet.
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <HbsEmailDialog
        open={hbsDialogOpen}
        onOpenChange={setHbsDialogOpen}
        onSaved={onHbsEmailSaved}
      />
    </div>
  );
}
