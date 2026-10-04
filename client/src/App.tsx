import { useMemo, useState } from "react";
import { startLogin } from "./const";
import { useAuth } from "./_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleDot,
  Clock3,
  Command,
  DatabaseZap,
  FileCheck2,
  Filter,
  Gauge,
  Inbox,
  Layers3,
  Link2,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Users,
  X,
  Zap,
} from "lucide-react";

const navItems = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "signals", label: "Signal inbox", icon: Inbox },
  { id: "actions", label: "Action queue", icon: ListChecks },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "playbooks", label: "Playbooks", icon: BookOpen },
  { id: "team", label: "Team ownership", icon: Users },
  { id: "audit", label: "Audit history", icon: FileCheck2 },
] as const;

type View = (typeof navItems)[number]["id"];
type Severity = "low" | "medium" | "high" | "critical";
type ActionStatus = "open" | "in_progress" | "done" | "dismissed";
type SignalStatus = "new" | "triaged" | "closed";
type Priority = Severity;

type Signal = {
  id: number; title: string; source: string; sourceType: string; severity: Severity; status: SignalStatus; summary: string; impact: string; occurredAt: Date;
};
type ActionItem = {
  id: number; signalId: number | null; title: string; description: string; ownerName: string; ownerEmail: string | null; priority: Priority; status: ActionStatus; dueAt: Date | null; createdAt: Date;
};
type Integration = {
  id: number; name: string; category: string; status: "connected" | "attention" | "available"; description: string; lastSyncAt: Date | null; recordsSynced: number;
};
type Playbook = {
  id: number; name: string; trigger: string; ownerName: string; priority: Priority; nextStep: string; status: "active" | "draft" | "archived";
};
type Member = { id: number; name: string; email: string | null; role: string; scope: string; avatarColor: string };
type AuditEvent = { id: number; actorName: string; action: string; entityType: string; entityId: number | null; context: string; createdAt: Date };
type Dashboard = { workspace: { id: number; name: string; timezone: string }; signals: Signal[]; actions: ActionItem[]; integrations: Integration[]; playbooks: Playbook[]; teamMembers: Member[]; auditEvents: AuditEvent[]; metrics: { urgentSignals: number; openActions: number; overdueActions: number; connectedIntegrations: number; totalIntegrations: number; signalVolume: number } };

const severityLabel: Record<Severity, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
const statusLabel: Record<ActionStatus, string> = { open: "Open", in_progress: "In progress", done: "Done", dismissed: "Dismissed" };

function formatTime(value: Date | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  const diff = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return `${Math.round(diff / 1440)}d ago`;
}

function formatDue(value: Date | null | undefined) {
  if (!value) return "No due date";
  const date = new Date(value);
  const overdue = date.getTime() < Date.now();
  return `${overdue ? "Overdue · " : "Due "}${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function initials(name: string) {
  return name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | Severity | "connected" | "attention" | "available" | "done" | "active" | "draft" | "archived" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function LoginScreen() {
  return (
    <div className="login-shell">
      <div className="login-orbit orbit-one" />
      <div className="login-orbit orbit-two" />
      <div className="login-card">
        <div className="brand-mark brand-mark-large"><Command size={22} strokeWidth={2.5} /></div>
        <p className="eyebrow">OPERATIONS, WITH SIGNAL</p>
        <h1>Make the next right move obvious.</h1>
        <p className="login-copy">Opsignal turns scattered operational changes into a clear queue of decisions, owners, and next steps.</p>
        <button className="button button-primary button-wide" onClick={() => startLogin()}><Sparkles size={16} /> Open your workspace <ArrowUpRight size={16} /></button>
        <div className="login-proof"><ShieldCheck size={15} /> Secure workspace access · persistent operational records</div>
      </div>
      <div className="login-footer"><span>OPSignal</span><span>Signal → context → action</span></div>
    </div>
  );
}

function LoadingScreen() {
  return <div className="loading-screen"><Loader2 className="spin" size={28} /><p>Loading your operating context…</p></div>;
}

function App() {
  const auth = useAuth({ redirectOnUnauthenticated: false });
  if (auth.loading) return <LoadingScreen />;
  if (!auth.user) return <LoginScreen />;
  return <Workspace user={auth.user} onLogout={auth.logout} />;
}

function Workspace({ user, onLogout }: { user: { name?: string | null; email?: string | null }; onLogout: () => Promise<void> }) {
  const [view, setView] = useState<View>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const dashboardQuery = trpc.opsignal.dashboard.useQuery(undefined, { retry: 1, refetchOnWindowFocus: false });
  const utils = trpc.useUtils();
  const signalMutation = trpc.opsignal.updateSignal.useMutation({ onSuccess: () => utils.opsignal.dashboard.invalidate() });
  const actionMutation = trpc.opsignal.updateAction.useMutation({ onSuccess: () => utils.opsignal.dashboard.invalidate() });
  const createActionMutation = trpc.opsignal.createAction.useMutation({ onSuccess: () => { utils.opsignal.dashboard.invalidate(); toast.success("Action added to the queue"); } });
  const createPlaybookMutation = trpc.opsignal.createPlaybook.useMutation({ onSuccess: () => { utils.opsignal.dashboard.invalidate(); toast.success("Playbook saved as a draft"); } });
  const playbookMutation = trpc.opsignal.updatePlaybook.useMutation({ onSuccess: () => utils.opsignal.dashboard.invalidate() });
  const dashboard = dashboardQuery.data as Dashboard | undefined;
  const displayName = user.name?.split(" ")[0] || "Operator";

  const runSignalUpdate = (signalId: number, status: SignalStatus) => signalMutation.mutate({ signalId, status }, { onSuccess: () => toast.success(status === "closed" ? "Signal closed" : "Signal triaged") });
  const runActionUpdate = (actionId: number, status: ActionStatus) => actionMutation.mutate({ actionId, status }, { onSuccess: () => toast.success(`Action marked ${statusLabel[status].toLowerCase()}`) });
  const navigate = (next: View) => { setView(next); setMobileMenu(false); };

  if (dashboardQuery.isLoading || !dashboard) return <LoadingScreen />;
  if (dashboardQuery.isError) return <div className="error-screen"><CircleAlert size={28} /><h2>We couldn’t load your workspace.</h2><p>Refresh to reconnect to the operating database.</p><button className="button button-primary" onClick={() => dashboardQuery.refetch()}><RefreshCw size={16} /> Try again</button></div>;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand"><div className="brand-mark"><Command size={17} strokeWidth={2.5} /></div><span>opsignal</span><span className="brand-beta">LIVE</span></div>
        <div className="workspace-switcher"><div className="workspace-dot">N</div><div><strong>{dashboard.workspace.name}</strong><span>Operations workspace</span></div><ChevronDown size={15} /></div>
        <div className="nav-section-label">Command center</div>
        <nav className="main-nav">
          {navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={`nav-item ${view === item.id ? "nav-item-active" : ""}`} onClick={() => navigate(item.id)}><Icon size={17} /><span>{item.label}</span>{item.id === "signals" && dashboard.metrics.urgentSignals > 0 && <span className="nav-count">{dashboard.metrics.urgentSignals}</span>}</button>; })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-status"><div className="status-pulse" /><div><strong>All systems nominal</strong><span>Last sync 6m ago</span></div></div>
        <button className="nav-item" onClick={() => toast.info("Workspace settings are next in the release queue") }><Settings2 size={17} /><span>Workspace settings</span></button>
        <button className="profile-row" onClick={() => void onLogout()}><div className="avatar avatar-user">{initials(user.name || "You")}</div><div><strong>{user.name || "You"}</strong><span>{user.email || "Signed in"}</span></div><LogOut size={15} /></button>
      </aside>
      {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation" />}
      <main className="main-content">
        <header className="topbar"><button className="mobile-menu-button" onClick={() => setMobileMenu(true)}><Menu size={20} /></button><div className="topbar-context"><span>Northstar Operations</span><span className="slash">/</span><strong>{navItems.find(item => item.id === view)?.label}</strong></div><div className="topbar-actions"><div className="sync-label"><span className="status-pulse" /> Synced just now</div><button className="icon-button" onClick={() => dashboardQuery.refetch()} title="Refresh data"><RefreshCw size={17} /></button><button className="icon-button notification-button" onClick={() => toast.info("No new operator alerts")} title="Notifications"><Bell size={17} /><span /></button><div className="avatar avatar-user">{initials(user.name || "You")}</div></div></header>
        <div className="content-wrap">
          {view === "overview" && <OverviewView dashboard={dashboard} displayName={displayName} onNavigate={navigate} onSignalUpdate={runSignalUpdate} onActionUpdate={runActionUpdate} />}
          {view === "signals" && <SignalsView signals={dashboard.signals} onUpdate={runSignalUpdate} />}
          {view === "actions" && <ActionsView dashboard={dashboard} onUpdate={runActionUpdate} onCreate={input => createActionMutation.mutate(input)} creating={createActionMutation.isPending} />}
          {view === "integrations" && <IntegrationsView integrations={dashboard.integrations} />}
          {view === "playbooks" && <PlaybooksView playbooks={dashboard.playbooks} team={dashboard.teamMembers} onCreate={input => createPlaybookMutation.mutate(input)} creating={createPlaybookMutation.isPending} onUpdate={(playbookId, status) => playbookMutation.mutate({ playbookId, status })} />}
          {view === "team" && <TeamView team={dashboard.teamMembers} actions={dashboard.actions} signals={dashboard.signals} />}
          {view === "audit" && <AuditView events={dashboard.auditEvents} />}
        </div>
      </main>
    </div>
  );
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</div>;
}

function OverviewView({ dashboard, displayName, onNavigate, onSignalUpdate, onActionUpdate }: { dashboard: Dashboard; displayName: string; onNavigate: (view: View) => void; onSignalUpdate: (id: number, status: SignalStatus) => void; onActionUpdate: (id: number, status: ActionStatus) => void }) {
  const urgent = dashboard.signals.filter(signal => signal.status !== "closed" && (signal.severity === "critical" || signal.severity === "high")).slice(0, 3);
  const open = dashboard.actions.filter(action => action.status === "open" || action.status === "in_progress").slice(0, 4);
  return <>
    <PageHeader eyebrow="Monday, October 4 · 08:42" title={`Good morning, ${displayName}.`} description="Here’s what deserves your attention before the day gets noisy." action={<button className="button button-quiet" onClick={() => onNavigate("audit")}><Activity size={16} /> View activity</button>} />
    <div className="signal-banner"><div className="banner-icon"><Sparkles size={18} /></div><div><strong>Opsignal found 3 decisions worth making today</strong><span>Two high-severity signals are still unowned. The fastest path is shown below.</span></div><button className="text-button" onClick={() => onNavigate("signals")}>Review signals <ArrowUpRight size={15} /></button></div>
    <div className="metric-grid">
      <MetricCard label="Urgent signals" value={dashboard.metrics.urgentSignals} detail="Need triage" tone="coral" icon={<CircleAlert size={17} />} onClick={() => onNavigate("signals")} />
      <MetricCard label="Open actions" value={dashboard.metrics.openActions} detail={`${dashboard.metrics.overdueActions} overdue`} tone="mint" icon={<ListChecks size={17} />} onClick={() => onNavigate("actions")} />
      <MetricCard label="Connected sources" value={`${dashboard.metrics.connectedIntegrations}/${dashboard.metrics.totalIntegrations}`} detail="Syncing normally" tone="lavender" icon={<DatabaseZap size={17} />} onClick={() => onNavigate("integrations")} />
      <MetricCard label="Signal volume" value={dashboard.metrics.signalVolume} detail="Last 7 days" tone="sand" icon={<Activity size={17} />} onClick={() => onNavigate("signals")} />
    </div>
    <div className="overview-grid">
      <section className="panel panel-large"><div className="panel-header"><div><p className="eyebrow">Priority lane</p><h2>Signals that change the plan</h2></div><button className="text-button" onClick={() => onNavigate("signals")}>Open inbox <ArrowUpRight size={15} /></button></div><div className="signal-list">{urgent.map(signal => <SignalRow key={signal.id} signal={signal} onTriage={() => onSignalUpdate(signal.id, signal.status === "triaged" ? "new" : "triaged")} />)}</div>{urgent.length === 0 && <EmptyState icon={<CheckCircle2 />} title="No urgent signals" copy="Your high-severity lane is clear." />}</section>
      <section className="panel"><div className="panel-header"><div><p className="eyebrow">Ownership</p><h2>Where work is landing</h2></div><button className="icon-button"><MoreHorizontal size={17} /></button></div><div className="ownership-list">{dashboard.teamMembers.slice(0, 4).map(member => { const load = dashboard.actions.filter(action => action.ownerName === member.name && action.status !== "done" && action.status !== "dismissed").length; return <div className="ownership-row" key={member.id}><div className="avatar" style={{ background: member.avatarColor }}>{initials(member.name)}</div><div className="ownership-copy"><strong>{member.name}</strong><span>{member.scope}</span></div><div className="load-meter"><span style={{ width: `${Math.min(100, Math.max(15, load * 25))}%` }} /></div><strong className="load-count">{load}</strong></div>; })}</div><button className="panel-foot-button" onClick={() => onNavigate("team")}>See ownership coverage <ArrowUpRight size={15} /></button></section>
    </div>
    <div className="overview-grid overview-grid-bottom">
      <section className="panel"><div className="panel-header"><div><p className="eyebrow">Action queue</p><h2>Next moves</h2></div><button className="text-button" onClick={() => onNavigate("actions")}>View all <ArrowUpRight size={15} /></button></div><div className="action-list">{open.map(action => <ActionRow key={action.id} action={action} onComplete={() => onActionUpdate(action.id, "done")} />)}</div></section>
      <section className="panel"><div className="panel-header"><div><p className="eyebrow">Operating rhythm</p><h2>Source health</h2></div><button className="text-button" onClick={() => onNavigate("integrations")}>Manage <ArrowUpRight size={15} /></button></div><div className="integration-mini-list">{dashboard.integrations.slice(0, 4).map(integration => <div className="integration-mini-row" key={integration.id}><div className={`integration-logo logo-${integration.name.toLowerCase()}`}>{integration.name.slice(0, 1)}</div><div><strong>{integration.name}</strong><span>{integration.status === "connected" ? `${integration.recordsSynced.toLocaleString()} records · ${formatTime(integration.lastSyncAt)}` : integration.status === "attention" ? "Needs attention" : "Ready to connect"}</span></div><Badge tone={integration.status}>{integration.status === "connected" ? "Healthy" : integration.status === "attention" ? "Attention" : "Available"}</Badge></div>)}</div></section>
    </div>
  </>;
}

function MetricCard({ label, value, detail, tone, icon, onClick }: { label: string; value: string | number; detail: string; tone: string; icon: React.ReactNode; onClick: () => void }) {
  return <button className={`metric-card metric-${tone}`} onClick={onClick}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}</strong><small>{detail} <ArrowUpRight size={12} /></small></button>;
}

function SignalRow({ signal, onTriage }: { signal: Signal; onTriage: () => void }) {
  return <div className="signal-row"><div className={`signal-severity severity-${signal.severity}`}><CircleDot size={14} /></div><div className="signal-row-main"><div className="row-title"><strong>{signal.title}</strong><Badge tone={signal.severity}>{severityLabel[signal.severity]}</Badge></div><p>{signal.summary}</p><div className="row-meta"><span>{signal.source}</span><span>·</span><span>{signal.sourceType}</span><span>·</span><span>{formatTime(signal.occurredAt)}</span></div></div><button className={`row-action ${signal.status === "triaged" ? "row-action-done" : ""}`} onClick={onTriage}>{signal.status === "triaged" ? <><Check size={15} /> Triaged</> : <>Triage <ArrowUpRight size={15} /></>}</button></div>;
}

function ActionRow({ action, onComplete }: { action: ActionItem; onComplete: () => void }) {
  return <div className="action-row"><button className={`check-button ${action.status === "done" ? "checked" : ""}`} onClick={onComplete}>{action.status === "done" && <Check size={13} />}</button><div className="action-row-main"><strong>{action.title}</strong><span>{action.ownerName} · {formatDue(action.dueAt)}</span></div><Badge tone={action.priority}>{severityLabel[action.priority]}</Badge></div>;
}

function SignalsView({ signals, onUpdate }: { signals: Signal[]; onUpdate: (id: number, status: SignalStatus) => void }) {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<"all" | Severity>("all");
  const filtered = useMemo(() => signals.filter(signal => (severity === "all" || signal.severity === severity) && `${signal.title} ${signal.summary} ${signal.source}`.toLowerCase().includes(query.toLowerCase())), [signals, query, severity]);
  return <><PageHeader eyebrow="Operational inbox" title="Signal inbox" description="Every meaningful change, with enough context to decide what happens next." action={<button className="button button-primary" onClick={() => toast.info("Live connectors can be added from Integrations") }><Plus size={16} /> Capture signal</button>} /><div className="toolbar"><div className="search-field"><Search size={16} /><input placeholder="Search signals" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="filter-wrap"><Filter size={15} /><select value={severity} onChange={event => setSeverity(event.target.value as "all" | Severity)}><option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div><span className="toolbar-count">{filtered.length} signals</span></div><section className="panel table-panel"><div className="table-head signal-table-head"><span>Signal</span><span>Source</span><span>Impact</span><span>Status</span><span /></div>{filtered.map(signal => <div className="table-row signal-table-row" key={signal.id}><div className="table-main"><div className={`signal-severity severity-${signal.severity}`}><CircleDot size={14} /></div><div><strong>{signal.title}</strong><span>{signal.summary}</span></div></div><div className="muted-cell"><strong>{signal.source}</strong><span>{signal.sourceType}</span></div><div className="impact-cell">{signal.impact}</div><div><Badge tone={signal.status === "closed" ? "done" : signal.status === "triaged" ? "active" : "neutral"}>{signal.status === "closed" ? "Closed" : signal.status === "triaged" ? "Triaged" : "New"}</Badge><span className="table-time">{formatTime(signal.occurredAt)}</span></div><div className="row-menu"><button className="icon-button" onClick={() => onUpdate(signal.id, signal.status === "closed" ? "new" : signal.status === "triaged" ? "closed" : "triaged")} title="Update signal"><MoreHorizontal size={17} /></button></div></div>)}{filtered.length === 0 && <EmptyState icon={<Search />} title="No matching signals" copy="Try a different search or severity filter." />}</section></>;
}

function ActionsView({ dashboard, onUpdate, onCreate, creating }: { dashboard: Dashboard; onUpdate: (id: number, status: ActionStatus) => void; onCreate: (input: { title: string; description: string; ownerName: string; priority: Priority; dueAt: Date | null }) => void; creating: boolean }) {
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | ActionStatus>("all");
  const [draft, setDraft] = useState({ title: "", description: "", ownerName: dashboard.teamMembers[0]?.name || "You", priority: "medium" as Priority, dueAt: "" });
  const visible = dashboard.actions.filter(action => statusFilter === "all" || action.status === statusFilter);
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!draft.title || !draft.description) return; onCreate({ title: draft.title, description: draft.description, ownerName: draft.ownerName, priority: draft.priority, dueAt: draft.dueAt ? new Date(`${draft.dueAt}T18:00:00`) : null }); setDraft({ ...draft, title: "", description: "", dueAt: "" }); setShowCreate(false); };
  return <><PageHeader eyebrow="Execution layer" title="Action queue" description="A shared list of what needs to happen, who owns it, and when it becomes a problem." action={<button className="button button-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Add action</button>} />{showCreate && <form className="create-panel" onSubmit={submit}><div className="create-panel-head"><div><p className="eyebrow">New action</p><h2>Make the next move explicit</h2></div><button type="button" className="icon-button" onClick={() => setShowCreate(false)}><X size={17} /></button></div><div className="form-grid"><label>Action title<input required value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="e.g. Confirm the billing owner" /></label><label>Owner<select value={draft.ownerName} onChange={event => setDraft({ ...draft, ownerName: event.target.value })}>{dashboard.teamMembers.map(member => <option key={member.id}>{member.name}</option>)}</select></label><label className="form-span">What good looks like<textarea required value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Describe the outcome, not just the task." /></label><label>Priority<select value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value as Priority })}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><label>Due date<input type="date" value={draft.dueAt} onChange={event => setDraft({ ...draft, dueAt: event.target.value })} /></label></div><div className="create-panel-actions"><button type="button" className="button button-quiet" onClick={() => setShowCreate(false)}>Cancel</button><button className="button button-primary" disabled={creating}>{creating ? <Loader2 className="spin" size={15} /> : <Plus size={15} />} Add to queue</button></div></form>}<div className="toolbar"><div className="filter-wrap"><SlidersHorizontal size={15} /><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as "all" | ActionStatus)}><option value="all">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Done</option><option value="dismissed">Dismissed</option></select></div><span className="toolbar-count">{visible.length} actions</span></div><section className="panel table-panel"><div className="table-head action-table-head"><span>Action</span><span>Owner</span><span>Priority</span><span>Due</span><span>Status</span><span /></div>{visible.map(action => <div className="table-row action-table-row" key={action.id}><div className="table-main"><button className={`check-button ${action.status === "done" ? "checked" : ""}`} onClick={() => onUpdate(action.id, action.status === "done" ? "open" : "done")}>{action.status === "done" && <Check size={13} />}</button><div><strong>{action.title}</strong><span>{action.description}</span></div></div><div className="owner-cell"><div className="avatar avatar-small">{initials(action.ownerName)}</div>{action.ownerName}</div><Badge tone={action.priority}>{severityLabel[action.priority]}</Badge><div className={action.dueAt && new Date(action.dueAt).getTime() < Date.now() && action.status !== "done" ? "overdue-cell" : "muted-cell"}><Clock3 size={14} />{formatDue(action.dueAt)}</div><Badge tone={action.status === "done" ? "done" : action.status === "in_progress" ? "active" : "neutral"}>{statusLabel[action.status]}</Badge><div className="row-menu"><button className="icon-button" onClick={() => onUpdate(action.id, action.status === "open" ? "in_progress" : action.status === "in_progress" ? "done" : "open")}><MoreHorizontal size={17} /></button></div></div>)}</section></>;
}

function IntegrationsView({ integrations }: { integrations: Integration[] }) {
  const connected = integrations.filter(item => item.status === "connected");
  return <><PageHeader eyebrow="Source health" title="Integrations" description="Keep the systems that feed your operating context visible, honest, and easy to connect." action={<button className="button button-primary" onClick={() => toast.info("Connector authorization will open here when a provider is selected") }><Plus size={16} /> Add integration</button>} /><div className="integration-summary"><div><span className="eyebrow">Connected now</span><strong>{connected.length} sources</strong><p>Last successful syncs are shown below. Opsignal never hides a stale feed.</p></div><div className="summary-health"><div className="health-ring"><span>{Math.round((connected.length / integrations.length) * 100)}%</span></div><div><strong>Coverage</strong><span>{connected.length} of {integrations.length} sources active</span></div></div></div><div className="integration-grid">{integrations.map(integration => <div className="integration-card" key={integration.id}><div className="integration-card-top"><div className={`integration-logo logo-${integration.name.toLowerCase()}`}>{integration.name.slice(0, 1)}</div><Badge tone={integration.status}>{integration.status === "connected" ? "Connected" : integration.status === "attention" ? "Attention" : "Available"}</Badge></div><h2>{integration.name}</h2><p>{integration.description}</p><div className="integration-card-foot"><span>{integration.status === "connected" ? `${integration.recordsSynced.toLocaleString()} records` : integration.status === "attention" ? "Sync needs review" : "Not connected"}</span><span>{integration.status === "connected" ? formatTime(integration.lastSyncAt) : <button className="text-button" onClick={() => toast.info(`Connect ${integration.name} from this workspace`)}>Connect <ArrowUpRight size={14} /></button>}</span></div></div>)}</div><div className="integration-note"><Zap size={17} /><div><strong>Why this matters</strong><span>Opsignal normalizes activity from each source into signals, so your team can act on changes instead of checking eight dashboards.</span></div></div></>;
}

function PlaybooksView({ playbooks, team, onCreate, creating, onUpdate }: { playbooks: Playbook[]; team: Member[]; onCreate: (input: { name: string; trigger: string; ownerName: string; priority: Priority; nextStep: string }) => void; creating: boolean; onUpdate: (id: number, status: "active" | "draft" | "archived") => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ name: "", trigger: "", ownerName: team[0]?.name || "You", priority: "medium" as Priority, nextStep: "" });
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!draft.name || !draft.trigger || !draft.nextStep) return; onCreate(draft); setDraft({ ...draft, name: "", trigger: "", nextStep: "" }); setShowCreate(false); };
  return <><PageHeader eyebrow="Repeatable response" title="Playbooks" description="Turn the patterns you keep explaining into operating responses the whole team can trust." action={<button className="button button-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> New playbook</button>} />{showCreate && <form className="create-panel" onSubmit={submit}><div className="create-panel-head"><div><p className="eyebrow">New playbook</p><h2>Give the team a better default</h2></div><button type="button" className="icon-button" onClick={() => setShowCreate(false)}><X size={17} /></button></div><div className="form-grid"><label>Name<input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Major customer escalation" /></label><label>Default owner<select value={draft.ownerName} onChange={event => setDraft({ ...draft, ownerName: event.target.value })}>{team.map(member => <option key={member.id}>{member.name}</option>)}</select></label><label className="form-span">Trigger<input required value={draft.trigger} onChange={event => setDraft({ ...draft, trigger: event.target.value })} placeholder="When should this playbook appear?" /></label><label>Priority<select value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value as Priority })}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><label className="form-span">Recommended next step<textarea required value={draft.nextStep} onChange={event => setDraft({ ...draft, nextStep: event.target.value })} placeholder="What should happen first?" /></label></div><div className="create-panel-actions"><button type="button" className="button button-quiet" onClick={() => setShowCreate(false)}>Cancel</button><button className="button button-primary" disabled={creating}>{creating ? <Loader2 className="spin" size={15} /> : <BookOpen size={15} />} Save playbook</button></div></form>}<div className="playbook-grid">{playbooks.map(playbook => <div className="playbook-card" key={playbook.id}><div className="playbook-card-top"><Badge tone={playbook.status}>{playbook.status === "active" ? "Active" : playbook.status === "draft" ? "Draft" : "Archived"}</Badge><button className="icon-button"><MoreHorizontal size={17} /></button></div><h2>{playbook.name}</h2><div className="playbook-block"><span>WHEN</span><strong>{playbook.trigger}</strong></div><div className="playbook-block"><span>NEXT STEP</span><strong>{playbook.nextStep}</strong></div><div className="playbook-card-foot"><div className="owner-cell"><div className="avatar avatar-small">{initials(playbook.ownerName)}</div>{playbook.ownerName}</div><Badge tone={playbook.priority}>{severityLabel[playbook.priority]}</Badge></div><div className="playbook-actions">{playbook.status === "active" ? <button className="text-button" onClick={() => onUpdate(playbook.id, "draft")}>Pause playbook</button> : playbook.status === "draft" ? <button className="text-button" onClick={() => onUpdate(playbook.id, "active")}><Play size={14} /> Activate</button> : <button className="text-button" onClick={() => onUpdate(playbook.id, "draft")}>Restore draft</button>}</div></div>)}</div></>;
}

function TeamView({ team, actions, signals }: { team: Member[]; actions: ActionItem[]; signals: Signal[] }) {
  return <><PageHeader eyebrow="Ownership map" title="Team ownership" description="Make responsibility visible before a signal turns into an escalation." action={<button className="button button-quiet" onClick={() => toast.info("Member invitations will open here") }><Users size={16} /> Invite member</button>} /><div className="team-summary"><div><span className="eyebrow">Coverage snapshot</span><strong>{team.length} operators · {actions.filter(action => action.status !== "done" && action.status !== "dismissed").length} active actions</strong></div><div className="coverage-bar"><span style={{ width: "78%" }} /></div><span className="coverage-label">78% clear ownership</span></div><div className="team-grid">{team.map(member => { const memberActions = actions.filter(action => action.ownerName === member.name && action.status !== "done" && action.status !== "dismissed"); const memberSignals = signals.filter(signal => signal.status !== "closed" && (member.name === "Ari Williams" ? signal.source === "PostHog" : member.name === "Maya Chen" ? signal.source === "Calendly" : member.name === "Jordan Bell" ? signal.source === "Stripe" : false)); return <div className="team-card" key={member.id}><div className="team-card-top"><div className="avatar avatar-large" style={{ background: member.avatarColor }}>{initials(member.name)}</div><Badge tone={memberActions.length > 2 ? "high" : "connected"}>{memberActions.length > 2 ? "At capacity" : "Available"}</Badge></div><h2>{member.name}</h2><p>{member.role}</p><div className="team-scope"><span>Focus</span><strong>{member.scope}</strong></div><div className="team-stats"><div><strong>{memberActions.length}</strong><span>active actions</span></div><div><strong>{memberSignals.length}</strong><span>related signals</span></div></div></div>; })}</div></>;
}

function AuditView({ events }: { events: AuditEvent[] }) {
  return <><PageHeader eyebrow="Trust layer" title="Audit history" description="A durable trace of how the workspace changed, so decisions stay explainable." action={<button className="button button-quiet" onClick={() => toast.info("Audit export will be available in workspace settings") }><FileCheck2 size={16} /> Export log</button>} /><section className="panel audit-panel"><div className="audit-intro"><div className="audit-icon"><ShieldCheck size={20} /></div><div><strong>Traceable by default</strong><span>Important changes are recorded with an actor, object and context.</span></div></div><div className="audit-list">{events.map(event => <div className="audit-row" key={event.id}><div className="audit-dot" /><div className="audit-row-main"><strong><span>{event.actorName}</span> {event.action}</strong><p>{event.context}</p><small>{event.entityType}{event.entityId ? ` #${event.entityId}` : ""} · {formatTime(event.createdAt)}</small></div></div>)}</div></section></>;
}

function EmptyState({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return <div className="empty-state"><div>{icon}</div><strong>{title}</strong><span>{copy}</span></div>;
}

export default App;
