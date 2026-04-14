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
import { Search, Brain, Calendar, Tag, Eye, Mail, Loader2, Copy, CheckCircle2 } from "lucide-react";

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
};

type MarketEvent = {
  eventName: string;
  eventDate: string;
  eventType: string;
  totalListings: number;
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
  return (
    <div
      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 border border-border"
      data-testid={`seller-card-${seller.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
          #{index + 1}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{seller.sellerName}</span>
            {seller.classYear && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                Class of 20{String(seller.classYear).padStart(2, "0")}
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
        <div className="font-bold text-base">${seller.askingPrice ?? "—"}</div>
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
                  placeholder="jsmith@hbs2027.hbs.edu"
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

        {step === 2 && seller && (
          <>
            <DialogHeader>
              <DialogTitle>Contact the seller</DialogTitle>
              <DialogDescription>
                Reach out to the seller and ask them to transfer the ticket to you first.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-2">
                <div className="font-medium text-sm">Seller contact info</div>
                <div className="text-sm"><span className="text-muted-foreground">Name:</span> {seller.sellerName}</div>
                <div className="text-sm flex items-center gap-2">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{seller.sellerEmail}</span>
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 text-sm text-blue-900 dark:text-blue-200 space-y-2">
                <div className="font-medium">Next steps:</div>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Contact {seller.sellerName} at <strong>{seller.sellerEmail}</strong></li>
                  <li>Ask them to transfer the ticket on <strong>{seller.platform}</strong></li>
                  <li>Once you have the ticket, click the button below</li>
                </ol>
              </div>
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
            <Input id="watch-email" data-testid="input-watch-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="jsmith@hbs2027.hbs.edu" />
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

export default function Marketplace() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [watchTarget, setWatchTarget] = useState<MarketEvent | null>(null);
  const [buyTarget, setBuyTarget] = useState<MarketEvent | null>(null);

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

      {/* Results */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="h-52 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : events && events.length > 0 ? (
        <div className="space-y-4">
          {events.map(event => (
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
                      <span className="flex items-center gap-1"><Tag size={11} />{event.totalListings} listing{event.totalListings !== 1 ? "s" : ""}</span>
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
            {debouncedSearch ? `No events match "${debouncedSearch}"` : "No tickets are currently listed for sale"}
          </p>
        </div>
      )}

      <WatchDialog event={watchTarget} open={!!watchTarget} onOpenChange={v => !v && setWatchTarget(null)} />
      <BuyDialog event={buyTarget} open={!!buyTarget} onOpenChange={v => !v && setBuyTarget(null)} />
    </div>
  );
}
