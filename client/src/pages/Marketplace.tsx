import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Brain, Calendar, Tag, Eye, Mail, Loader2, Copy, CheckCircle2, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type TopSeller = {
  id: number;
  userId: number;
  userLikelihood: number;
  aiLikelihood: number | null;
  askingPrice: number | null;
  pricePaid: number;
  platform: string;
  sellerName: string;
  sellerEmail: string;
  classYear?: number | null;
  listingType: "active" | "passive";
};

type MarketEvent = {
  eventName: string;
  eventDate: string;
  eventType: string;
  totalListings: number;
  activeListings: number;
  passiveListings: number;
  watchers: number;
  topSellers: TopSeller[];
};

function likelihoodClass(score: number) {
  if (score >= 65) return "likelihood-high";
  if (score >= 40) return "likelihood-medium";
  return "likelihood-low";
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

function maskEmail(email: string) {
  // Show first letter + *** + @hbsYYYY.hbs.edu (or full domain for other formats)
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return email;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex); // includes @
  return local.charAt(0) + "***" + domain;
}

function SellerCard({ seller, index }: { seller: TopSeller; index: number }) {
  const score = seller.aiLikelihood ?? seller.userLikelihood;
  const discount = seller.askingPrice && seller.pricePaid > 0
    ? Math.round((1 - seller.askingPrice / seller.pricePaid) * 100)
    : 0;
  const isPassive = seller.listingType === "passive";
  return (
    <div
      className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${isPassive ? "bg-muted/20 border-dashed border-border" : "bg-muted/50 border-border"}`}
      data-testid={`seller-card-${seller.id}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isPassive ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
          #{index + 1}
        </div>
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium">{seller.sellerName}</span>
            {seller.classYear && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                Class of {seller.classYear}
              </span>
            )}
            {isPassive ? (
              <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-medium">
                Might sell
              </span>
            ) : (
              <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full font-medium">
                Listed
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{maskEmail(seller.sellerEmail)}</div>
          <div className={`text-xs px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 mt-0.5 ${likelihoodClass(score)}`}>
            <Brain size={9} />{score}% likely to go
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold text-base">{seller.askingPrice ? `$${seller.askingPrice}` : <span className="text-muted-foreground text-sm">No price set</span>}</div>
        {discount > 0 && (
          <div className="text-xs text-green-700 dark:text-green-400 font-medium">{discount}% off</div>
        )}
      </div>
    </div>
  );
}

// ── Buy Dialog (3-step flow) ────────────────────────────────────────────────

function BuyDialog({
  event,
  open,
  onOpenChange,
}: {
  event: MarketEvent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [transactionId, setTransactionId] = useState<number | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<TopSeller | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setStep(1);
    setName("");
    setEmail("");
    setTransactionId(null);
    setSelectedSeller(null);
    setCopied(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // Pick the first seller (lowest likelihood)
  const seller = selectedSeller ?? event?.topSellers[0] ?? null;

  const interestMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/transactions", data),
    onSuccess: async (res: any) => {
      const data = await res.json();
      setTransactionId(data.id);
      setSelectedSeller(seller);
      setStep(2);
    },
    onError: () => {
      toast({ title: "Something went wrong", variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/transactions/${id}/status`, { status }),
    onSuccess: (_, vars) => {
      if (vars.status === "ticket_transferred") {
        setStep(3);
      } else if (vars.status === "payment_done") {
        toast({ title: "Transaction complete!", description: "Payment marked as done. Enjoy the event!" });
        handleClose(false);
        queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      }
    },
    onError: () => {
      toast({ title: "Something went wrong", variant: "destructive" });
    },
  });

  const submitInterest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !seller) return;
    interestMutation.mutate({
      ticketId: seller.id,
      buyerName: name,
      buyerEmail: email,
    });
  };

  const copyAmount = () => {
    if (seller?.askingPrice) {
      navigator.clipboard.writeText(String(seller.askingPrice));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle>Buy a ticket</DialogTitle>
              <DialogDescription>
                Express interest in "{event?.eventName}". The seller will transfer the ticket to you first before you pay.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitInterest} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="buy-name">Your name</Label>
                <Input
                  id="buy-name"
                  data-testid="input-buy-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Alex Chen"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="buy-email">HBS email</Label>
                <Input
                  id="buy-email"
                  data-testid="input-buy-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="jsmith@mba2027.hbs.edu"
                />
              </div>
              {seller && (
                <div className="rounded-lg bg-muted/50 border border-border p-3 text-sm space-y-1">
                  <div className="font-medium">You'll be connected with:</div>
                  <div>{seller.sellerName} — {maskEmail(seller.sellerEmail)}</div>
                  <div className="text-muted-foreground">Asking: ${seller.askingPrice ?? "TBD"} on {seller.platform}</div>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
                <Button type="submit" disabled={interestMutation.isPending}>
                  {interestMutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                  Express Interest
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {step === 2 && seller && event && (
          <>
            <DialogHeader>
              <DialogTitle>Email the seller</DialogTitle>
              <DialogDescription>
                {seller.listingType === "passive"
                  ? "This seller hasn't listed yet — your message should gauge their interest first."
                  : "Copy and send this email to the seller. They transfer the ticket before you pay."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Seller contact row */}
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 border border-border px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{seller.sellerName}</div>
                  <div className="text-xs font-mono text-muted-foreground">{seller.sellerEmail}</div>
                </div>
                <Button
                  size="sm" variant="outline" className="text-xs shrink-0"
                  onClick={() => { navigator.clipboard.writeText(seller.sellerEmail); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                >
                  {copied ? <CheckCircle2 size={12} className="mr-1 text-green-500" /> : <Copy size={12} className="mr-1" />}
                  {copied ? "Copied!" : "Copy email"}
                </Button>
              </div>

              {/* Generated email */}
              {(() => {
                const isPassive = seller.listingType === "passive";
                const discount = seller.askingPrice && seller.pricePaid > 0
                  ? Math.round((1 - seller.askingPrice / seller.pricePaid) * 100)
                  : 0;
                const suggestedPrice = seller.askingPrice ?? (seller.pricePaid > 0 ? Math.round(seller.pricePaid * 0.85) : null);
                const suggestedDiscount = suggestedPrice && seller.pricePaid > 0
                  ? Math.round((1 - suggestedPrice / seller.pricePaid) * 100)
                  : 0;

                const emailBody = isPassive
                  ? `Hi ${seller.sellerName.split(" ")[0]},

I came across your ticket for ${event.eventName} on FomoHedge and saw you might be open to selling it. Would you consider letting it go?${suggestedPrice ? `

I'd suggest $${suggestedPrice}${suggestedDiscount > 0 ? ` (${suggestedDiscount}% off what you paid)` : ""} as a starting point — happy to discuss.` : ""}

Please transfer the ticket to me first and I'll pay you right after — that way it's safe for both of us.

Let me know if you're open to it!

${name}`
                  : `Hi ${seller.sellerName.split(" ")[0]},

I'm interested in buying your ticket for ${event.eventName}${seller.askingPrice ? ` at $${seller.askingPrice}` : ""}${discount > 0 ? ` (${discount}% off the original $${seller.pricePaid})` : ""}.

Could you transfer the ticket to me on ${seller.platform} first? I'll pay you immediately after — this protects us both.

Thanks!
${name}`;

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Suggested email</span>
                      <Button
                        size="sm" variant="outline" className="text-xs h-7"
                        onClick={() => { navigator.clipboard.writeText(emailBody); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      >
                        {copied ? <CheckCircle2 size={12} className="mr-1 text-green-500" /> : <Copy size={12} className="mr-1" />}
                        {copied ? "Copied!" : "Copy email"}
                      </Button>
                    </div>
                    <pre className="text-xs whitespace-pre-wrap bg-muted/50 border border-border rounded-lg p-3 leading-relaxed font-sans">
                      {emailBody}
                    </pre>
                  </div>
                );
              })()}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
                <Button
                  onClick={() => transactionId && statusMutation.mutate({ id: transactionId, status: "ticket_transferred" })}
                  disabled={statusMutation.isPending}
                >
                  {statusMutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                  I received the ticket
                </Button>
              </DialogFooter>
            </div>
          </>
        )}

        {step === 3 && seller && (
          <>
            <DialogHeader>
              <DialogTitle>Complete payment</DialogTitle>
              <DialogDescription>
                You've received the ticket. Now pay the seller via Venmo or PayPal.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-3">
                <div className="font-medium text-sm">Payment details</div>
                <div className="text-sm"><span className="text-muted-foreground">Pay to:</span> {seller.sellerName}</div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm"><span className="text-muted-foreground">Amount:</span> <span className="font-bold text-lg">${seller.askingPrice}</span></div>
                  <Button size="sm" variant="outline" onClick={copyAmount} className="text-xs shrink-0">
                    {copied ? <CheckCircle2 size={13} className="mr-1 text-green-500" /> : <Copy size={13} className="mr-1" />}
                    {copied ? "Copied!" : "Copy amount"}
                  </Button>
                </div>
              </div>
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-sm text-green-900 dark:text-green-200">
                Send <strong>${seller.askingPrice}</strong> to <strong>{seller.sellerName}</strong> via Venmo or PayPal, then mark as done.
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
                <Button
                  onClick={() => transactionId && statusMutation.mutate({ id: transactionId, status: "payment_done" })}
                  disabled={statusMutation.isPending}
                >
                  {statusMutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                  Mark payment as done
                </Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Watch Dialog ────────────────────────────────────────────────────────────

function WatchDialog({
  event,
  open,
  onOpenChange,
}: {
  event: MarketEvent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [budget, setBudget] = useState("");

  const watchMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/watchlist", data),
    onSuccess: () => {
      toast({ title: "You're watching this event", description: "You'll be shown to sellers searching for buyers." });
      onOpenChange(false);
      setName(""); setEmail(""); setBudget("");
    },
    onError: () => {
      toast({ title: "Something went wrong", variant: "destructive" });
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    watchMutation.mutate({
      watcherName: name,
      watcherEmail: email,
      eventName: event.eventName,
      maxBudget: budget ? parseFloat(budget) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Watch this event</DialogTitle>
          <DialogDescription>
            We'll add you to the buyer pool for "{event?.eventName}". Sellers with low bail likelihood will be shown your interest.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="watch-name">Your name</Label>
            <Input id="watch-name" data-testid="input-watch-name" value={name} onChange={e => setName(e.target.value)} required placeholder="Alex Chen" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="watch-email">HBS email</Label>
            <Input id="watch-email" data-testid="input-watch-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="jsmith@mba2027.hbs.edu" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="watch-budget">Max budget (optional)</Label>
            <Input id="watch-budget" data-testid="input-watch-budget" type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="$50" min={0} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={watchMutation.isPending}>
              {watchMutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Watch event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Marketplace Page ───────────────────────────────────────────────────

const EVENT_TYPES = ["party", "trek", "conference", "career", "other"] as const;
const TYPE_LABELS: Record<string, string> = {
  party: "Party", trek: "Trek", conference: "Conference", career: "Career", other: "Other",
};

export default function Marketplace() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [watchTarget, setWatchTarget] = useState<MarketEvent | null>(null);
  const [buyTarget, setBuyTarget] = useState<MarketEvent | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("any");
  const [sortBy, setSortBy] = useState<string>("default");
  const [listingTypeFilter, setListingTypeFilter] = useState<string>("all");

  const { data: events, isLoading } = useQuery<MarketEvent[]>({
    queryKey: ["/api/marketplace", debouncedSearch],
    queryFn: async () => {
      const url = debouncedSearch ? `/api/marketplace?q=${encodeURIComponent(debouncedSearch)}` : "/api/marketplace";
      const res = await fetch(url);
      return res.json();
    },
  });

  const handleSearchChange = (v: string) => {
    setSearch(v);
    clearTimeout((window as any)._searchTimer);
    (window as any)._searchTimer = setTimeout(() => setDebouncedSearch(v), 300);
  };

  // Apply filters + sort client-side
  const filteredEvents = (events ?? [])
    .filter(e => typeFilter === "all" || e.eventType === typeFilter)
    .filter(e => listingTypeFilter === "all" || (listingTypeFilter === "active" ? e.activeListings > 0 : e.passiveListings > 0))
    .filter(e => {
      if (dateFilter === "any") return true;
      const days = Math.ceil((new Date(e.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (dateFilter === "7") return days <= 7 && days >= 0;
      if (dateFilter === "30") return days <= 30 && days >= 0;
      if (dateFilter === "90") return days <= 90 && days >= 0;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "price-asc") {
        const aMin = Math.min(...a.topSellers.map(s => s.askingPrice ?? Infinity));
        const bMin = Math.min(...b.topSellers.map(s => s.askingPrice ?? Infinity));
        return aMin - bMin;
      }
      if (sortBy === "price-desc") {
        const aMin = Math.min(...a.topSellers.map(s => s.askingPrice ?? 0));
        const bMin = Math.min(...b.topSellers.map(s => s.askingPrice ?? 0));
        return bMin - aMin;
      }
      if (sortBy === "popular") return b.watchers - a.watchers;
      if (sortBy === "date-asc") return a.eventDate.localeCompare(b.eventDate);
      return 0; // default: server order
    });

  const activeFilterCount = (typeFilter !== "all" ? 1 : 0) + (dateFilter !== "any" ? 1 : 0) + (sortBy !== "default" ? 1 : 0) + (listingTypeFilter !== "all" ? 1 : 0);

  const displayDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Marketplace</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Browse tickets from sellers most likely to bail — sorted by lowest AI likelihood
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          data-testid="marketplace-search"
          placeholder="Search events..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Event type pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium shrink-0">Type:</span>
          <button
            onClick={() => setTypeFilter("all")}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${typeFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
          >
            All
          </button>
          {EVENT_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}
              className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${typeFilter === t ? `${eventTypeBadge(t)} border-transparent` : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Listing type */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium shrink-0">Sellers:</span>
          {[
            { value: "all", label: "All sellers" },
            { value: "active", label: "Listed for sale" },
            { value: "passive", label: "Might sell" },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setListingTypeFilter(opt.value)}
              className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                listingTypeFilter === opt.value
                  ? opt.value === "active" ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700"
                    : opt.value === "passive" ? "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700"
                    : "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Date range + Sort */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={13} className="text-muted-foreground shrink-0" />
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="Any date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any date</SelectItem>
              <SelectItem value="7">Within 1 week</SelectItem>
              <SelectItem value="30">Within 30 days</SelectItem>
              <SelectItem value="90">Within 90 days</SelectItem>
            </SelectContent>
          </Select>

          <ArrowUpDown size={13} className="text-muted-foreground shrink-0 ml-1" />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-8 text-xs w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Most likely to bail</SelectItem>
              <SelectItem value="popular">Most watched</SelectItem>
              <SelectItem value="date-asc">Soonest first</SelectItem>
              <SelectItem value="price-asc">Lowest price</SelectItem>
              <SelectItem value="price-desc">Highest price</SelectItem>
            </SelectContent>
          </Select>

          {activeFilterCount > 0 && (
            <button
              onClick={() => { setTypeFilter("all"); setDateFilter("any"); setSortBy("default"); setListingTypeFilter("all"); }}
              className="text-xs text-muted-foreground hover:text-foreground underline ml-1 shrink-0"
            >
              Clear {activeFilterCount > 1 ? `${activeFilterCount} filters` : "filter"}
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="h-52 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className="space-y-4">
          {filteredEvents.map(event => (
            <Card key={event.eventName} className="ticket-card border-border bg-card" data-testid={`market-event-${event.eventName.replace(/\s/g, "-")}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{event.eventName}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${eventTypeBadge(event.eventType)}`}>
                        {event.eventType}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar size={11} />{displayDate(event.eventDate)}</span>
                      <span className="flex items-center gap-1">
                        <Tag size={11} />
                        {event.activeListings > 0 && <span className="text-green-700 dark:text-green-400">{event.activeListings} listed</span>}
                        {event.activeListings > 0 && event.passiveListings > 0 && <span>·</span>}
                        {event.passiveListings > 0 && <span className="text-orange-600 dark:text-orange-400">{event.passiveListings} might sell</span>}
                      </span>
                      <span className="flex items-center gap-1"><Eye size={11} />{event.watchers} watching</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setWatchTarget(event)}
                    data-testid="watch-btn"
                    className="shrink-0 text-xs"
                  >
                    <Eye size={13} className="mr-1" />Watch
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Brain size={11} />
                  Showing the 2 sellers with lowest AI-predicted attendance likelihood
                </p>
                <div className="space-y-2">
                  {event.topSellers.map((s, i) => (
                    <SellerCard key={s.id} seller={s} index={i} />
                  ))}
                </div>
                {event.topSellers.length > 0 && (
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setBuyTarget(event)}
                    data-testid="contact-seller-btn"
                  >
                    <Mail size={13} className="mr-1.5" />
                    I'm interested — connect me with a seller
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Search size={36} className="mx-auto text-muted-foreground/50 mb-3" />
          <p className="font-medium">No listings found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {debouncedSearch ? `No events match "${debouncedSearch}"` : activeFilterCount > 0 ? "No events match your filters" : "No tickets are currently listed for sale"}
          </p>
        </div>
      )}

      <WatchDialog event={watchTarget} open={!!watchTarget} onOpenChange={v => !v && setWatchTarget(null)} />
      <BuyDialog event={buyTarget} open={!!buyTarget} onOpenChange={v => !v && setBuyTarget(null)} />
    </div>
  );
}
