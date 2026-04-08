import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  PenLine, Mail, Camera, Upload, Loader2, CheckCircle,
  ArrowLeft, Info, Copy, Link2, RefreshCw, Plug
} from "lucide-react";

const FORWARD_EMAIL = "alex-chen@fomohedge.com";

// ── Manual Entry Tab ──────────────────────────────────────────────────────────
function ManualForm() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({
    eventName: "", eventDate: "", eventType: "party", platform: "manual",
    pricePaid: "", notes: "",
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tickets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({ title: "Ticket added!", description: "Head to My Tickets to set your likelihood." });
      navigate("/");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ ...form, pricePaid: parseFloat(form.pricePaid) || 0, userId: 1 });
  };

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="manual-form">
      <div className="space-y-1.5">
        <Label htmlFor="eventName">Event name *</Label>
        <Input
          id="eventName" data-testid="input-event-name"
          value={form.eventName} onChange={e => setForm(f => ({ ...f, eventName: e.target.value }))}
          required placeholder="HBS Winter Formal 2026"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="eventDate">Date *</Label>
          <Input
            id="eventDate" data-testid="input-event-date"
            type="date" value={form.eventDate}
            onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pricePaid">Price paid ($)</Label>
          <Input
            id="pricePaid" data-testid="input-price-paid"
            type="number" min={0} step={0.01}
            value={form.pricePaid} onChange={e => setForm(f => ({ ...f, pricePaid: e.target.value }))}
            placeholder="0"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="eventType">Event type</Label>
          <Select value={form.eventType} onValueChange={v => setForm(f => ({ ...f, eventType: v }))}>
            <SelectTrigger id="eventType" data-testid="select-event-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="party">Party / Social</SelectItem>
              <SelectItem value="trek">Trek / Trip</SelectItem>
              <SelectItem value="conference">Conference</SelectItem>
              <SelectItem value="career">Career / Networking</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="platform">Platform</Label>
          <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
            <SelectTrigger id="platform" data-testid="select-platform">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eventbrite">Eventbrite</SelectItem>
              <SelectItem value="partiful">Partiful</SelectItem>
              <SelectItem value="luma">Luma</SelectItem>
              <SelectItem value="manual">Other / Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes" data-testid="input-notes"
          value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="e.g. 10-day trek, departs April 3"
          rows={2}
        />
      </div>
      <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="submit-manual">
        {createMutation.isPending ? <Loader2 size={15} className="mr-1.5 animate-spin" /> : null}
        Add ticket
      </Button>
    </form>
  );
}

// ── Email Forward Tab ─────────────────────────────────────────────────────────
function EmailForwardTab() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [simSubject, setSimSubject] = useState("");
  const [simBody, setSimBody] = useState("");
  const [result, setResult] = useState<any>(null);

  const copied = () => {
    navigator.clipboard.writeText(FORWARD_EMAIL);
    toast({ title: "Copied!", description: "Paste this address when forwarding your confirmation email." });
  };

  const simulateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/ingest/email", data),
    onSuccess: (data: any) => {
      setResult(data);
      if (data.created) queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
    onError: () => toast({ title: "Error parsing email", variant: "destructive" }),
  });

  const simulate = (e: React.FormEvent) => {
    e.preventDefault();
    simulateMutation.mutate({ subject: simSubject, bodySnippet: simBody });
  };

  return (
    <div className="space-y-5">
      {/* Step 1: copy address */}
      <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
          <div>
            <p className="font-medium text-sm">Copy your personal import address</p>
            <p className="text-xs text-muted-foreground mt-0.5">Every ticket confirmation you forward here gets auto-imported.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-card border border-border rounded-md px-3 py-2 text-sm font-mono text-primary">
            {FORWARD_EMAIL}
          </code>
          <Button size="sm" variant="outline" onClick={copied} data-testid="copy-email">
            <Copy size={13} className="mr-1" />Copy
          </Button>
        </div>
      </div>

      {/* Step 2: instructions */}
      <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
          <div>
            <p className="font-medium text-sm">Forward any confirmation email</p>
            <p className="text-xs text-muted-foreground mt-0.5">Works with Eventbrite, Partiful, Luma, travel agents, Google Forms receipts — anything that sends a confirmation.</p>
          </div>
        </div>
      </div>

      {/* Step 3: auto-import */}
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
          <div>
            <p className="font-medium text-sm">We parse and import automatically</p>
            <p className="text-xs text-muted-foreground mt-0.5">Event name, date, and price are extracted. A ticket card is created in your dashboard.</p>
          </div>
        </div>
      </div>

      {/* Demo simulator */}
      <div className="border-t border-border pt-4">
        <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
          <Info size={11} />Try the demo — simulate a forwarded email
        </p>
        <form onSubmit={simulate} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sim-subject" className="text-xs">Email subject</Label>
            <Input
              id="sim-subject" data-testid="input-sim-subject"
              value={simSubject} onChange={e => setSimSubject(e.target.value)}
              placeholder="Your booking confirmation: HBS Ski Trip to Stowe"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sim-body" className="text-xs">Email body snippet</Label>
            <Textarea
              id="sim-body" data-testid="input-sim-body"
              value={simBody} onChange={e => setSimBody(e.target.value)}
              placeholder="Your payment of $350 was received. Trip departs March 15, 2026..."
              rows={3}
            />
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={simulateMutation.isPending} data-testid="submit-email-sim">
            {simulateMutation.isPending ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Mail size={13} className="mr-1.5" />}
            Parse email
          </Button>
        </form>

        {result && (
          <div className={`mt-3 rounded-md p-3 text-sm border ${result.created ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-muted border-border"}`}>
            {result.created ? (
              <div className="flex items-center gap-2 text-green-800 dark:text-green-300 font-medium">
                <CheckCircle size={14} />Ticket imported successfully
              </div>
            ) : (
              <p className="text-muted-foreground">Could not extract event details. Try adding it manually.</p>
            )}
            {result.parsed && (
              <div className="mt-1.5 text-xs text-muted-foreground space-y-0.5">
                {result.parsed.eventName && <div>Event: <span className="font-medium text-foreground">{result.parsed.eventName}</span></div>}
                {result.parsed.date && <div>Date: <span className="font-medium text-foreground">{result.parsed.date}</span></div>}
                {result.parsed.price && <div>Price: <span className="font-medium text-foreground">${result.parsed.price}</span></div>}
              </div>
            )}
            {result.created && (
              <button onClick={() => navigate("/")} className="mt-2 text-xs text-primary underline">
                View in My Tickets →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Screenshot Tab ────────────────────────────────────────────────────────────
function ScreenshotTab() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({ eventName: "", eventDate: "", pricePaid: "", platform: "screenshot" });
  const [result, setResult] = useState<any>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const uploadMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("/api/ingest/screenshot", { method: "POST", body: data });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data: any) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({ title: "Ticket imported!", description: "Your screenshot was processed." });
    },
    onError: () => toast({ title: "Could not parse screenshot", description: "Please fill in details manually.", variant: "destructive" }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append("image", file);
    fd.append("eventName", form.eventName);
    fd.append("eventDate", form.eventDate);
    fd.append("pricePaid", form.pricePaid);
    fd.append("platform", form.platform);
    uploadMutation.mutate(fd);
  };

  return (
    <div className="space-y-5">
      {/* Instructions */}
      <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
        <div className="flex items-start gap-2">
          <Info size={14} className="text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Take a screenshot of any confirmation — a Partiful invite, WhatsApp message, travel agent confirmation, or Google Form receipt — then upload it here.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4" data-testid="screenshot-form">
        {/* File drop zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            preview ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/50"
          }`}
          onClick={() => fileRef.current?.click()}
          data-testid="screenshot-dropzone"
        >
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          {preview ? (
            <div className="space-y-2">
              <img src={preview} alt="Preview" className="max-h-40 mx-auto rounded-md object-contain" />
              <p className="text-xs text-muted-foreground">{file?.name} · Click to change</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Camera size={28} className="mx-auto text-muted-foreground/50" />
              <p className="text-sm font-medium">Upload screenshot</p>
              <p className="text-xs text-muted-foreground">Click to browse · PNG, JPG, WEBP</p>
            </div>
          )}
        </div>

        {/* Confirm / fill details */}
        {preview && (
          <div className="space-y-3 border border-border rounded-lg p-4 bg-card">
            <p className="text-xs font-medium text-muted-foreground">Confirm event details</p>
            <div className="space-y-1.5">
              <Label htmlFor="ss-name" className="text-xs">Event name *</Label>
              <Input id="ss-name" data-testid="input-ss-name" value={form.eventName} onChange={e => setForm(f => ({ ...f, eventName: e.target.value }))} required placeholder="Event name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ss-date" className="text-xs">Date *</Label>
                <Input id="ss-date" data-testid="input-ss-date" type="date" value={form.eventDate} onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ss-price" className="text-xs">Price paid ($)</Label>
                <Input id="ss-price" data-testid="input-ss-price" type="number" min={0} value={form.pricePaid} onChange={e => setForm(f => ({ ...f, pricePaid: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={uploadMutation.isPending} data-testid="submit-screenshot">
              {uploadMutation.isPending ? <Loader2 size={15} className="mr-1.5 animate-spin" /> : <Upload size={15} className="mr-1.5" />}
              Import ticket
            </Button>
          </div>
        )}
      </form>

      {result?.ok && (
        <div className="rounded-md p-3 bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
          <CheckCircle size={14} />
          Ticket imported! <button onClick={() => navigate("/")} className="underline ml-1">View in My Tickets →</button>
        </div>
      )}
    </div>
  );
}

// ── Connected Accounts (Import) Tab ──────────────────────────────────────────
function ImportTab() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState<string | null>(null);

  // Parse ?connected= or ?error= from hash query string (e.g. /#/add?connected=eventbrite)
  useEffect(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf("?");
    if (qIdx < 0) return;
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) {
      setJustConnected(connected);
      toast({ title: `${connected.charAt(0).toUpperCase() + connected.slice(1)} connected!`, description: "Click Sync to import your events." });
      window.history.replaceState(null, "", "/#/add");
    }
    if (error) {
      const messages: Record<string, string> = {
        eventbrite_not_configured: "Eventbrite OAuth credentials not set in .env",
        outlook_not_configured: "Outlook OAuth credentials not set in .env",
        token_exchange_failed: "Token exchange failed — check your client secret",
        auth_failed: "Authentication was cancelled or failed",
      };
      toast({ title: "Connection failed", description: messages[error] || error, variant: "destructive" });
      window.history.replaceState(null, "", "/#/add");
    }
  }, []);

  const { data: connections = [], refetch: refetchConnections } = useQuery<string[]>({
    queryKey: ["/api/connections"],
    queryFn: () => apiRequest("GET", "/api/connections"),
  });

  const sync = async (provider: string) => {
    setSyncingProvider(provider);
    try {
      const result: any = await apiRequest("POST", `/api/sync/${provider}`, {});
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({
        title: result.imported === 0 ? "Already up to date" : `${result.imported} event${result.imported !== 1 ? "s" : ""} imported`,
        description: result.imported > 0 ? "Check My Tickets to see them." : "No new events found.",
      });
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      setSyncingProvider(null);
    }
  };

  const isConnected = (provider: string) =>
    connections.includes(provider) || justConnected === provider;

  const providers = [
    {
      id: "eventbrite",
      name: "Eventbrite",
      icon: "🎟️",
      description: "Import all your purchased event tickets",
      available: true,
    },
    {
      id: "outlook",
      name: "Outlook Calendar",
      icon: "📅",
      description: "Import upcoming events from your HBS calendar",
      available: true,
    },
    {
      id: "partiful",
      name: "Partiful",
      icon: "🎉",
      description: "No public API — forward invite emails instead",
      available: false,
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Connect your accounts to pull in all your events automatically.
      </p>

      {providers.map((p) => (
        <div key={p.id} className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0">{p.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm">{p.name}</p>
                {isConnected(p.id) && (
                  <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                    Connected
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
              {!p.available && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Use the Email tab to forward Partiful invite emails.
                </p>
              )}
            </div>
          </div>

          {p.available && (
            <div className="shrink-0">
              {isConnected(p.id) ? (
                <Button size="sm" onClick={() => sync(p.id)} disabled={syncingProvider === p.id}>
                  {syncingProvider === p.id
                    ? <Loader2 size={13} className="mr-1.5 animate-spin" />
                    : <RefreshCw size={13} className="mr-1.5" />}
                  Sync
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <a href={`/api/auth/${p.id}`}>
                    <Link2 size={13} className="mr-1.5" />Connect
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      ))}

      <p className="text-xs text-muted-foreground pt-1">
        Add <code className="bg-muted px-1 rounded">EVENTBRITE_CLIENT_ID</code> / <code className="bg-muted px-1 rounded">OUTLOOK_CLIENT_ID</code> to your <code className="bg-muted px-1 rounded">.env</code> to enable OAuth.
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AddTicket() {
  const [, navigate] = useLocation();

  // If returning from OAuth, open the Import tab automatically
  const defaultTab = (() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf("?");
    if (qIdx >= 0) {
      const params = new URLSearchParams(hash.slice(qIdx + 1));
      if (params.has("connected") || params.has("error")) return "import";
    }
    return "manual";
  })();

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground -ml-2">
          <ArrowLeft size={15} className="mr-1" />Back
        </Button>
      </div>

      <div>
        <h1 className="text-xl font-bold">Add a ticket</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Four ways to import — pick whatever's easiest
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="manual" data-testid="tab-manual">
            <PenLine size={13} className="mr-1.5" />Manual
          </TabsTrigger>
          <TabsTrigger value="email" data-testid="tab-email">
            <Mail size={13} className="mr-1.5" />Email
          </TabsTrigger>
          <TabsTrigger value="screenshot" data-testid="tab-screenshot">
            <Camera size={13} className="mr-1.5" />Photo
          </TabsTrigger>
          <TabsTrigger value="import" data-testid="tab-import">
            <Plug size={13} className="mr-1.5" />Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Manual entry</CardTitle>
              <CardDescription>Fill in the details yourself — takes 30 seconds</CardDescription>
            </CardHeader>
            <CardContent><ManualForm /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Forward a confirmation email</CardTitle>
              <CardDescription>Works for Eventbrite, Partiful, travel agents, anything</CardDescription>
            </CardHeader>
            <CardContent><EmailForwardTab /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="screenshot" className="mt-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upload a screenshot</CardTitle>
              <CardDescription>Great for WhatsApp confirmations, Partiful invites, or anything without an email</CardDescription>
            </CardHeader>
            <CardContent><ScreenshotTab /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="mt-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Connected accounts</CardTitle>
              <CardDescription>Log in once, sync all your events automatically</CardDescription>
            </CardHeader>
            <CardContent><ImportTab /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
