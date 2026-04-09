import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Ticket, ChevronDown, ChevronUp,
  Tag, Brain, Calendar, DollarSign, X, Plus, CheckCircle2
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

function TicketCard({ ticket, isPast }: { ticket: TicketWithConflicts; isPast: boolean }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [likelihood, setLikelihood] = useState(ticket.userLikelihood);

  const activeConflicts = ticket.conflicts.filter(c => !c.dismissed);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<any>) => apiRequest("PATCH", `/api/tickets/${ticket.id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tickets"] }),
  });

  const dismissConflict = useMutation({
    mutationFn: (conflictId: number) => apiRequest("POST", `/api/conflicts/${conflictId}/dismiss`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tickets"] }),
  });

  const toggleList = () => {
    const newListed = ticket.isListed === 1 ? 0 : 1;
    const askingPrice = newListed ? Math.round(ticket.pricePaid * 0.85) : null;
    updateMutation.mutate({ isListed: newListed, askingPrice });
    toast({
      title: newListed ? "Ticket listed for sale" : "Listing removed",
      description: newListed
        ? `Listed at $${askingPrice} — visible to buyers in the marketplace.`
        : "Your ticket is no longer visible to buyers.",
    });
  };

  const aiScore = ticket.aiLikelihood ?? ticket.userLikelihood;
  const displayDate = new Date(ticket.eventDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const daysUntil = Math.ceil((new Date(ticket.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <Card className={`ticket-card border-border bg-card overflow-hidden ${isPast ? "opacity-80" : ""}`} data-testid={`ticket-card-${ticket.id}`}>
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
          </>
        )}
      </CardContent>
    </Card>
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

  const today = new Date().toISOString().split("T")[0];
  const upcoming = tickets?.filter(t => t.eventDate >= today) ?? [];
  const past = tickets?.filter(t => t.eventDate < today) ?? [];

  const activeConflictCount = upcoming.reduce((sum, t) => sum + t.conflicts.filter(c => !c.dismissed).length, 0);
  const listedCount = upcoming.filter(t => t.isListed).length;

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
                {upcoming.map(t => <TicketCard key={t.id} ticket={t} isPast={false} />)}
              </div>
            ) : <EmptyState />}
          </TabsContent>

          <TabsContent value="past" className="mt-4">
            {past.length > 0 ? (
              <div className="space-y-3">
                {past.map(t => <TicketCard key={t.id} ticket={t} isPast={true} />)}
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No past events yet.
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
