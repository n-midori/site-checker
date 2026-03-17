"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ── 型定義 ────────────────────────────────────────────────────
type Member = { id: number; name: string; role: string };
type Comment = { id?: number; issue_id?: number; author: string; text: string; date: string };
type Status = { id: number; name: string; color: string; order: number };
type Issue = {
  id: number; url: string; title: string; detail: string;
  priority: string; status: string; assignee: string;
  reporter: string; page: string; x: number; y: number;
  created_at: string; updated_at: string;
  screenshot_url?: string;
  comments: Comment[];
};

// ── 定数 ────────────────────────────────────────────────────
const PRIORITIES = ["高", "中", "低"];
const PRIORITY_COLOR: Record<string, { bg: string; text: string }> = {
  "高": { bg: "#FEF2F2", text: "#DC2626" },
  "中": { bg: "#FFFBEB", text: "#D97706" },
  "低": { bg: "#F8FAFC", text: "#64748B" },
};
const PRIORITY_ORDER: Record<string, number> = { "高": 0, "中": 1, "低": 2 };

// ── 色ヘルパー ──────────────────────────────────────────────
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) };
}
function statusColors(color: string) {
  const { r, g, b } = hexToRgb(color || "#64748B");
  return {
    text: color || "#64748B",
    bg: `rgba(${r},${g},${b},0.08)`,
    border: `rgba(${r},${g},${b},0.25)`,
  };
}

// ── 小コンポーネント ─────────────────────────────────────────
function StatusBadge({ label, statuses }: { label: string; statuses: Status[] }) {
  const st = statuses.find(s => s.name === label);
  const c = st ? statusColors(st.color) : { bg: "#F8FAFC", text: "#64748B", border: "#E2E8F0" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      letterSpacing: "0.02em", whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

const PriorityBadge = ({ label }: { label: string }) => {
  const c = PRIORITY_COLOR[label];
  if (!c) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.text, letterSpacing: "0.02em", whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 8 }}>●</span>{label}
    </span>
  );
};

const Tooltip = ({ children, text }: { children: React.ReactNode; text: string }) => {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)", background: "#1E293B", color: "#fff",
          fontSize: 11, padding: "4px 8px", borderRadius: 4, whiteSpace: "nowrap",
          pointerEvents: "none", zIndex: 100,
        }}>{text}</span>
      )}
    </span>
  );
};

// ── 該当箇所リンク生成 ───────────────────────────────────────
function buildLocationLink(issue: Issue) {
  const params = new URLSearchParams({
    sc_id: String(issue.id), sc_x: String(issue.x), sc_y: String(issue.y), sc_title: issue.title,
  });
  return `${issue.url}?${params.toString()}`;
}

// ── メインアプリ ─────────────────────────────────────────────
export default function App() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState("");
  const [view, setView] = useState<"list" | "detail" | "members" | "statuses">("list");
  const [selected, setSelected] = useState<Issue | null>(null);
  const [newComment, setNewComment] = useState("");

  const [filterStatus, setFilterStatus] = useState("すべて");
  const [filterPriority, setFilterPriority] = useState("すべて");
  const [filterAssignee, setFilterAssignee] = useState("すべて");
  const [filterUrl, setFilterUrl] = useState("すべて");
  const [filterMine, setFilterMine] = useState(false);
  const [sortPriority, setSortPriority] = useState(false);
  const [searchText, setSearchText] = useState("");

  const [showNew, setShowNew] = useState(false);
  const [showDelete, setShowDelete] = useState<number | null>(null);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);

  // ステータス管理用
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [editStatus, setEditStatus] = useState<Status | null>(null);
  const [statusForm, setStatusForm] = useState({ name: "", color: "#64748B" });

  // インライン編集用
  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);
  const [editingAssigneeId, setEditingAssigneeId] = useState<number | null>(null);
  const [editingDetailId, setEditingDetailId] = useState<number | null>(null);
  const [editingDetailText, setEditingDetailText] = useState("");
  // 詳細画面の詳細説明インライン編集用
  const [editingDetailViewDetail, setEditingDetailViewDetail] = useState(false);
  const [editingDetailViewText, setEditingDetailViewText] = useState("");
  // ドロップダウン座標用
  const [dropdownPos, setDropdownPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);

  const [newForm, setNewForm] = useState({
    url: "", title: "", detail: "", priority: "中", assignee: "", page: "", reporter: "",
  });
  const [memberForm, setMemberForm] = useState({ name: "", role: "" });

  // ── Supabase データ取得 ──────────────────────────────────
  const fetchMembers = useCallback(async () => {
    const { data } = await supabase.from("members").select("*").order("id");
    if (data) {
      setMembers(data);
      if (!currentUser && data.length > 0) setCurrentUser(data[0].name);
    }
  }, [currentUser]);

  const fetchIssues = useCallback(async () => {
    const { data: issuesData } = await supabase.from("issues").select("*").order("id");
    if (!issuesData) return;
    const { data: commentsData } = await supabase.from("comments").select("*").order("id");
    const commentsByIssue: Record<number, Comment[]> = {};
    (commentsData || []).forEach((c: any) => {
      if (!commentsByIssue[c.issue_id]) commentsByIssue[c.issue_id] = [];
      commentsByIssue[c.issue_id].push(c);
    });
    setIssues(issuesData.map((issue: any) => ({ ...issue, comments: commentsByIssue[issue.id] || [] })));
  }, []);

  const fetchStatuses = useCallback(async () => {
    const { data } = await supabase.from("statuses").select("*").order("order");
    if (data) setStatuses(data);
  }, []);

  useEffect(() => {
    Promise.all([fetchMembers(), fetchIssues(), fetchStatuses()]).then(() => {
      setLoading(false);
      // URLパラメータで ?issue=ID が指定されていたら詳細画面を開く
      const params = new URLSearchParams(window.location.search);
      const issueId = params.get("issue");
      if (issueId) {
        const id = parseInt(issueId, 10);
        setIssues(prev => {
          const found = prev.find(i => i.id === id);
          if (found) { setSelected(found); setView("detail"); }
          return prev;
        });
      }
    });
  }, [fetchMembers, fetchIssues, fetchStatuses]);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (editingStatusId === null && editingAssigneeId === null) return;
    const handleClick = () => { setEditingStatusId(null); setEditingAssigneeId(null); setDropdownPos(null); };
    const timer = setTimeout(() => document.addEventListener("click", handleClick), 0);
    return () => { clearTimeout(timer); document.removeEventListener("click", handleClick); };
  }, [editingStatusId, editingAssigneeId]);

  // スクロール時にドロップダウンを閉じる
  useEffect(() => {
    if (editingStatusId === null && editingAssigneeId === null) return;
    const handleScroll = () => { setEditingStatusId(null); setEditingAssigneeId(null); setDropdownPos(null); };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [editingStatusId, editingAssigneeId]);

  // ── 派生データ ──────────────────────────────────────────────
  const statusNames = useMemo(() => statuses.map(s => s.name), [statuses]);
  const doneStatusNames = useMemo(() => {
    // "完了" と "対応なし" に相当するもの（order が最後の2つ、または名前で判定）
    return statuses.filter(s => s.name === "完了" || s.name === "対応なし").map(s => s.name);
  }, [statuses]);

  const resetFilters = () => {
    setFilterStatus("すべて"); setFilterPriority("すべて");
    setFilterAssignee("すべて"); setFilterUrl("すべて");
    setFilterMine(false); setSortPriority(false); setSearchText("");
  };
  const isFiltered = filterStatus !== "すべて" || filterPriority !== "すべて" ||
    filterAssignee !== "すべて" || filterUrl !== "すべて" || filterMine || searchText !== "";

  const memberNames = useMemo(() => members.map(m => m.name), [members]);
  const uniqueUrls = useMemo(() => [...new Set(issues.map(i => i.url).filter(Boolean))], [issues]);

  const filtered = useMemo(() => {
    let list = [...issues];
    if (filterStatus === "__open__") list = list.filter(i => !doneStatusNames.includes(i.status));
    else if (filterStatus !== "すべて") list = list.filter(i => i.status === filterStatus);
    if (filterPriority !== "すべて") list = list.filter(i => i.priority === filterPriority);
    if (filterAssignee !== "すべて") list = list.filter(i => i.assignee === filterAssignee);
    if (filterUrl !== "すべて") list = list.filter(i => i.url === filterUrl);
    if (filterMine) list = list.filter(i => i.assignee === currentUser);
    if (searchText) list = list.filter(i => i.title.includes(searchText) || i.detail.includes(searchText));
    if (sortPriority) list.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    return list;
  }, [issues, filterStatus, filterPriority, filterAssignee, filterUrl, filterMine, sortPriority, searchText, currentUser, doneStatusNames]);

  const stats = useMemo(() => ({
    total: issues.length,
    open: issues.filter(i => !doneStatusNames.includes(i.status)).length,
    done: issues.filter(i => i.status === "完了").length,
    high: issues.filter(i => i.priority === "高" && !doneStatusNames.includes(i.status)).length,
  }), [issues, doneStatusNames]);

  // ── Supabase アクション ──────────────────────────────────
  const updateStatus = async (id: number, status: string) => {
    const updated_at = new Date().toISOString().slice(0, 10);
    await supabase.from("issues").update({ status, updated_at }).eq("id", id);
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status, updated_at } : i));
    setSelected(s => s?.id === id ? { ...s, status, updated_at } : s);
  };

  const updateAssignee = async (id: number, assignee: string) => {
    const updated_at = new Date().toISOString().slice(0, 10);
    await supabase.from("issues").update({ assignee, updated_at }).eq("id", id);
    setIssues(prev => prev.map(i => i.id === id ? { ...i, assignee, updated_at } : i));
    setSelected(s => s?.id === id ? { ...s, assignee, updated_at } : s);
  };

  const updateDetail = async (id: number, detail: string) => {
    const updated_at = new Date().toISOString().slice(0, 10);
    await supabase.from("issues").update({ detail, updated_at }).eq("id", id);
    setIssues(prev => prev.map(i => i.id === id ? { ...i, detail, updated_at } : i));
    setSelected(s => s?.id === id ? { ...s, detail, updated_at } : s);
  };

  const addComment = async (id: number) => {
    if (!newComment.trim()) return;
    const comment = { issue_id: id, author: currentUser, text: newComment, date: new Date().toISOString().slice(0, 10) };
    const { data } = await supabase.from("comments").insert(comment).select().single();
    if (data) {
      setIssues(prev => prev.map(i => i.id === id ? { ...i, comments: [...i.comments, data] } : i));
      setSelected(s => s && s.id === id ? { ...s, comments: [...s.comments, data] } : s);
    }
    setNewComment("");
  };

  const addIssue = async () => {
    if (!newForm.title) return;
    const today = new Date().toISOString().slice(0, 10);
    const row = {
      url: newForm.url, title: newForm.title, detail: newForm.detail,
      priority: newForm.priority, status: statusNames[0] || "未対応",
      assignee: newForm.assignee || memberNames[0] || "",
      reporter: newForm.reporter || currentUser,
      page: newForm.page || "", x: 50, y: 50,
      created_at: today, updated_at: today,
    };
    const { data } = await supabase.from("issues").insert(row).select().single();
    if (data) setIssues(prev => [...prev, { ...data, comments: [] }]);
    setShowNew(false);
    setNewForm({ url: "", title: "", detail: "", priority: "中", assignee: "", page: "", reporter: "" });
  };

  const deleteIssue = async (id: number) => {
    await supabase.from("comments").delete().eq("issue_id", id);
    await supabase.from("issues").delete().eq("id", id);
    setIssues(prev => prev.filter(i => i.id !== id));
    setShowDelete(null);
    if (selected?.id === id) { setSelected(null); setView("list"); }
  };

  const saveMember = async () => {
    if (!memberForm.name.trim()) return;
    if (editMember) {
      await supabase.from("members").update({ name: memberForm.name, role: memberForm.role }).eq("id", editMember.id);
      setMembers(prev => prev.map(m => m.id === editMember.id ? { ...m, ...memberForm } : m));
    } else {
      const { data } = await supabase.from("members").insert({ name: memberForm.name, role: memberForm.role }).select().single();
      if (data) setMembers(prev => [...prev, data]);
    }
    setShowMemberForm(false); setEditMember(null); setMemberForm({ name: "", role: "" });
  };

  const deleteMember = async (id: number) => {
    await supabase.from("members").delete().eq("id", id);
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  // ── ステータス CRUD ──────────────────────────────────────
  const saveStatus = async () => {
    if (!statusForm.name.trim()) return;
    if (editStatus) {
      await supabase.from("statuses").update({ name: statusForm.name, color: statusForm.color }).eq("id", editStatus.id);
      setStatuses(prev => prev.map(s => s.id === editStatus.id ? { ...s, ...statusForm } : s));
    } else {
      const newOrder = statuses.length > 0 ? Math.max(...statuses.map(s => s.order)) + 1 : 0;
      const { data } = await supabase.from("statuses").insert({ name: statusForm.name, color: statusForm.color, order: newOrder }).select().single();
      if (data) setStatuses(prev => [...prev, data]);
    }
    setShowStatusForm(false); setEditStatus(null); setStatusForm({ name: "", color: "#64748B" });
  };

  const deleteStatus = async (id: number) => {
    await supabase.from("statuses").delete().eq("id", id);
    setStatuses(prev => prev.filter(s => s.id !== id));
  };

  const moveStatus = async (id: number, direction: -1 | 1) => {
    const idx = statuses.findIndex(s => s.id === id);
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= statuses.length) return;
    const updated = [...statuses];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    // order を振り直し
    const promises = updated.map((s, i) =>
      supabase.from("statuses").update({ order: i }).eq("id", s.id)
    );
    await Promise.all(promises);
    setStatuses(updated.map((s, i) => ({ ...s, order: i })));
  };

  // ── スタイル ─────────────────────────────────────────────────
  const S = {
    app: { fontFamily: "'IBM Plex Sans JP','Noto Sans JP',sans-serif", background: "#F1F5F9", minHeight: "100vh", color: "#333333" },
    header: { background: "#0F172A", color: "#F8FAFC", padding: "0 24px", height: 52, display: "flex" as const, alignItems: "center" as const, justifyContent: "space-between" as const, position: "sticky" as const, top: 0, zIndex: 50 },
    logo: { display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 700 },
    logoMark: { width: 28, height: 28, background: "#3B82F6", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 },
    nav: { display: "flex", gap: 2 },
    navBtn: (active: boolean) => ({
      background: active ? "#1E293B" : "none", color: active ? "#F8FAFC" : "#B0B8C4",
      border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
    }),
    main: { maxWidth: 1200, margin: "0 auto", padding: "20px 24px" },
    statsRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 },
    statCard: (c: string) => ({ background: "#fff", borderRadius: 8, padding: "14px 18px", borderLeft: `3px solid ${c}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }),
    statNum: { fontSize: 28, fontWeight: 800, lineHeight: 1, marginBottom: 2 },
    statLabel: { fontSize: 11, color: "#666666", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" as const },
    filterBar: { background: "#fff", borderRadius: 8, padding: "14px 18px", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", flexWrap: "wrap" as const, gap: 10, alignItems: "center" },
    select: { border: "1px solid #E2E8F0", borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "#333333", background: "#fff", cursor: "pointer", outline: "none" },
    toggleBtn: (a: boolean) => ({ border: `1px solid ${a ? "#2563EB" : "#E2E8F0"}`, borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, background: a ? "#EFF6FF" : "#fff", color: a ? "#2563EB" : "#333333", cursor: "pointer" }),
    input: { border: "1px solid #E2E8F0", borderRadius: 6, padding: "5px 10px", fontSize: 12, outline: "none", color: "#333333" },
    table: { width: "100%", borderCollapse: "collapse" as const },
    th: { padding: "10px 14px", textAlign: "left" as const, fontSize: 11, fontWeight: 700, color: "#555555", letterSpacing: "0.06em", textTransform: "uppercase" as const, borderBottom: "2px solid #E2E8F0", background: "#F8FAFC" },
    td: { padding: "12px 14px", borderBottom: "1px solid #F1F5F9", fontSize: 13, verticalAlign: "middle" as const },
    addBtn: { display: "flex", alignItems: "center", gap: 6, background: "#2563EB", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
    iconBtn: (color = "#555555") => ({ background: "none", border: "none", cursor: "pointer", color, fontSize: 15, padding: "4px 6px", borderRadius: 4, lineHeight: 1 }),
    sectionLabel: { fontSize: 11, fontWeight: 700, color: "#666666", letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 8 },
    card: { background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "visible" as const },
    modal: { position: "fixed" as const, inset: 0, background: "rgba(15,23,42,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
    modalBox: { background: "#fff", borderRadius: 10, padding: 28, width: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" as const },
    formLabel: { fontSize: 12, fontWeight: 700, color: "#333333", display: "block", marginBottom: 4 },
    formInput: { width: "100%", border: "1px solid #E2E8F0", borderRadius: 6, padding: "7px 10px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const, marginBottom: 14 },
    linkBtn: { display: "inline-flex", alignItems: "center", gap: 4, color: "#2563EB", fontSize: 12, textDecoration: "none", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 5, padding: "4px 10px", fontWeight: 600, cursor: "pointer" },
  };

  if (loading) {
    return (
      <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#555555" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>読み込み中...</div>
        </div>
      </div>
    );
  }

  // ── ステータス管理画面 ─────────────────────────────────────
  const StatusesView = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>ステータス管理</h2>
        <button style={S.addBtn} onClick={() => { setEditStatus(null); setStatusForm({ name: "", color: "#64748B" }); setShowStatusForm(true); }}>
          ＋ ステータスを追加
        </button>
      </div>
      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>{["並び順", "ステータス名", "色", "プレビュー", "操作"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {statuses.map((st, idx) => (
              <tr key={st.id}>
                <td style={S.td}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button style={S.iconBtn()} disabled={idx === 0} onClick={() => moveStatus(st.id, -1)}>▲</button>
                    <button style={S.iconBtn()} disabled={idx === statuses.length - 1} onClick={() => moveStatus(st.id, 1)}>▼</button>
                  </div>
                </td>
                <td style={{ ...S.td, fontWeight: 600 }}>{st.name}</td>
                <td style={S.td}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 3, background: st.color, border: "1px solid #E2E8F0" }} />
                    <span style={{ fontSize: 12, color: "#555555", fontFamily: "monospace" }}>{st.color}</span>
                  </div>
                </td>
                <td style={S.td}><StatusBadge label={st.name} statuses={statuses} /></td>
                <td style={S.td}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button style={S.iconBtn("#2563EB")} title="編集" onClick={() => { setEditStatus(st); setStatusForm({ name: st.name, color: st.color }); setShowStatusForm(true); }}>✏️</button>
                    <button style={S.iconBtn("#DC2626")} title="削除" onClick={() => deleteStatus(st.id)}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── メンバー管理画面 ─────────────────────────────────────────
  const MembersView = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>メンバー管理</h2>
        <button style={S.addBtn} onClick={() => { setEditMember(null); setMemberForm({ name: "", role: "" }); setShowMemberForm(true); }}>
          ＋ メンバーを追加
        </button>
      </div>
      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>{["名前", "役割", "担当件数（未完了）", "操作"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {members.map(m => {
              const count = issues.filter(i => i.assignee === m.name && !doneStatusNames.includes(i.status)).length;
              return (
                <tr key={m.id}>
                  <td style={S.td}>
                    <span style={{ fontWeight: 600 }}>{m.name}</span>
                    {m.name === currentUser && <span style={{ marginLeft: 6, fontSize: 11, background: "#EFF6FF", color: "#2563EB", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>自分</span>}
                  </td>
                  <td style={{ ...S.td, color: "#555555" }}>{m.role}</td>
                  <td style={S.td}>
                    <span style={{ fontWeight: 700, color: count > 0 ? "#D97706" : "#888888" }}>{count}</span>
                    <span style={{ color: "#888888", fontSize: 12 }}> 件</span>
                  </td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button style={S.iconBtn("#2563EB")} title="編集" onClick={() => { setEditMember(m); setMemberForm({ name: m.name, role: m.role }); setShowMemberForm(true); }}>✏️</button>
                      <button style={S.iconBtn("#DC2626")} title="削除" onClick={() => deleteMember(m.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── 詳細ビュー ───────────────────────────────────────────────
  const DetailView = () => {
    const issue = issues.find(i => i.id === selected?.id);
    if (!issue) return null;
    const locationLink = buildLocationLink(issue);

    return (
      <div>
        <button style={{ ...S.iconBtn(), marginBottom: 12, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }} onClick={() => { setView("list"); setSelected(null); }}>
          ← 一覧に戻る
        </button>
        <div style={S.card}>
          <div style={{ background: "#0F172A", color: "#fff", padding: "18px 24px" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <PriorityBadge label={issue.priority} />
              <StatusBadge label={issue.status} statuses={statuses} />
              <span style={{ fontSize: 11, color: "#888888", alignSelf: "center" }}>#{issue.id}</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>{issue.title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#888888" }}>{[issue.url, issue.page].filter(Boolean).join(" · ") || "URL未設定"}</span>
              {issue.url && (
                <Tooltip text="ブラウザ拡張がある場合、該当箇所をハイライト表示します">
                  <a href={locationLink} target="_blank" rel="noopener noreferrer" style={S.linkBtn}>📍 該当箇所を開く</a>
                </Tooltip>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px" }}>
            <div style={{ padding: 24, borderRight: "1px solid #F1F5F9" }}>
              <div style={{ marginBottom: 24 }}>
                <div style={S.sectionLabel}>指摘箇所プレビュー</div>
                <div style={{ position: "relative", background: "#0F172A", borderRadius: 8, height: issue.screenshot_url ? 240 : 160, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {issue.screenshot_url ? (
                    <>
                      <img src={issue.screenshot_url} alt="スクリーンショット" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#0F172A" }} />
                      <div style={{ position: "absolute", left: `${issue.x}%`, top: `${issue.y}%`, transform: "translate(-50%,-50%)", width: 28, height: 28, borderRadius: "50%", background: "rgba(239,68,68,0.2)", border: "2px solid #EF4444", boxShadow: "0 0 0 4px rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 800 }}>{issue.id}</div>
                    </>
                  ) : (
                    <>
                      <span style={{ color: "#888888", fontSize: 12 }}>スクリーンショット（拡張機能で取得）</span>
                      <div style={{ position: "absolute", left: `${issue.x}%`, top: `${issue.y}%`, transform: "translate(-50%,-50%)" }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#EF4444", border: "3px solid #fff", boxShadow: "0 0 0 3px rgba(239,68,68,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800 }}>{issue.id}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={S.sectionLabel}>詳細説明</div>
                {editingDetailViewDetail ? (
                  <textarea
                    autoFocus
                    value={editingDetailViewText}
                    onChange={e => setEditingDetailViewText(e.target.value)}
                    onBlur={() => { updateDetail(issue.id, editingDetailViewText); setEditingDetailViewDetail(false); }}
                    onKeyDown={e => { if (e.key === "Escape") setEditingDetailViewDetail(false); }}
                    style={{ width: "100%", fontSize: 14, lineHeight: 1.8, color: "#333333", border: "1px solid #93C5FD", borderRadius: 6, padding: "8px 10px", resize: "vertical", minHeight: 80, outline: "none", background: "#EFF6FF", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                ) : (
                  <div
                    style={{ cursor: "pointer", borderRadius: 6, padding: "6px 8px", position: "relative" }}
                    onClick={() => { setEditingDetailViewDetail(true); setEditingDetailViewText(issue.detail || ""); }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#F1F5F9"; (e.currentTarget.querySelector(".edit-hint") as HTMLElement)?.style.setProperty("opacity", "1"); }}
                    onMouseLeave={e => { e.currentTarget.style.background = ""; (e.currentTarget.querySelector(".edit-hint") as HTMLElement)?.style.setProperty("opacity", "0"); }}
                  >
                    {issue.detail ? (
                      <p style={{ fontSize: 14, lineHeight: 1.8, color: "#333333", margin: 0 }}>{issue.detail}</p>
                    ) : (
                      <p style={{ fontSize: 14, color: "#888888", fontStyle: "italic", margin: 0 }}>クリックして詳細を追加...</p>
                    )}
                    <span className="edit-hint" style={{ position: "absolute", top: 6, right: 8, opacity: 0, transition: "opacity 0.15s", fontSize: 12, color: "#888888", display: "flex", alignItems: "center", gap: 4 }}>
                      ✏️ <span style={{ fontSize: 11 }}>クリックして編集</span>
                    </span>
                  </div>
                )}
              </div>
              <div>
                <div style={S.sectionLabel}>コメント ({issue.comments.length})</div>
                {issue.comments.map((c, i) => (
                  <div key={i} style={{ background: "#F8FAFC", borderRadius: 6, padding: "10px 14px", marginBottom: 8, fontSize: 13, lineHeight: 1.6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{c.author}</span>
                      <span style={{ fontSize: 11, color: "#888888" }}>{c.date}</span>
                    </div>
                    <div style={{ color: "#333333" }}>{c.text}</div>
                  </div>
                ))}
                <textarea
                  style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 10px", fontSize: 13, resize: "vertical", minHeight: 72, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                  placeholder="コメントを追加…" value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && e.metaKey) addComment(issue.id); }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: "#888888" }}>⌘+Enter で送信</span>
                  <button onClick={() => addComment(issue.id)} style={{ ...S.addBtn, fontSize: 12, padding: "7px 14px" }}>送信</button>
                </div>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={S.sectionLabel}>ステータス</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {statuses.map(st => {
                    const c = statusColors(st.color);
                    const active = issue.status === st.name;
                    return (
                      <button key={st.id} onClick={() => updateStatus(issue.id, st.name)} style={{
                        border: `1px solid ${active ? c.border : "#E2E8F0"}`,
                        borderRadius: 6, padding: "8px 12px", textAlign: "left",
                        background: active ? c.bg : "#fff",
                        color: active ? c.text : "#374151",
                        fontSize: 13, fontWeight: active ? 700 : 400, cursor: "pointer",
                      }}>
                        {active ? "✓ " : ""}{st.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={S.sectionLabel}>担当者</div>
                <select style={{ ...S.formInput, marginBottom: 0 }} value={issue.assignee || ""}
                  onChange={e => updateAssignee(issue.id, e.target.value)}>
                  <option value="">未割当</option>
                  {memberNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
                {[
                  ["起票者", issue.reporter], ["優先度", issue.priority],
                  ["対象ページ", issue.page], ["作成日", issue.created_at], ["更新日", issue.updated_at],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={S.sectionLabel}>{label}</div>
                    <div style={{ fontSize: 13, color: "#333333", fontWeight: 500 }}>{val || "—"}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowDelete(issue.id)} style={{ width: "100%", border: "1px solid #FECACA", borderRadius: 6, padding: "8px 12px", background: "#FEF2F2", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                🗑 この修正依頼を削除
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── 一覧ビュー ───────────────────────────────────────────────
  const ListView = () => (
    <div>
      <div style={S.statsRow}>
        {[
          { label: "総件数", val: stats.total, color: "#94A3B8", onClick: resetFilters },
          { label: "未完了", val: stats.open, color: "#D97706", onClick: () => { resetFilters(); setFilterStatus("__open__"); } },
          { label: "完了済み", val: stats.done, color: "#16A34A", onClick: () => { resetFilters(); setFilterStatus("完了"); } },
          { label: "優先度・高（未完了）", val: stats.high, color: "#DC2626", onClick: () => { resetFilters(); setFilterPriority("高"); setFilterStatus("__open__"); } },
        ].map(({ label, val, color, onClick }) => {
          const isActive =
            (label === "未完了" && filterStatus === "__open__" && filterPriority === "すべて") ||
            (label === "完了済み" && filterStatus === "完了") ||
            (label === "優先度・高（未完了）" && filterPriority === "高" && filterStatus === "__open__");
          return (
            <div key={label} onClick={onClick} style={{
              ...S.statCard(color), cursor: "pointer",
              outline: isActive ? `2px solid ${color}` : "none", outlineOffset: 2, userSelect: "none",
            }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)")}
            >
              <div style={{ ...S.statNum, color }}>{val}</div>
              <div style={{ ...S.statLabel, display: "flex", alignItems: "center", gap: 4 }}>
                {label}{label !== "総件数" && <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={S.filterBar}>
        <input style={{ ...S.input, width: 200 }} placeholder="🔍 タイトル・内容を検索"
          value={searchText} onChange={e => setSearchText(e.target.value)} />
        <select style={S.select} value={filterStatus === "__open__" ? "__open__" : filterStatus}
          onChange={e => setFilterStatus(e.target.value)}>
          <option value="すべて">すべて</option>
          <option value="__open__">未完了（全ステータス）</option>
          {statusNames.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={S.select} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option>すべて</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        <select style={S.select} value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
          <option>すべて</option>{memberNames.map(m => <option key={m}>{m}</option>)}
        </select>
        <select style={{ ...S.select, maxWidth: 220 }} value={filterUrl} onChange={e => setFilterUrl(e.target.value)}>
          <option>すべて</option>
          {uniqueUrls.map(u => <option key={u} value={u}>{u.replace("https://", "")}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button style={S.toggleBtn(filterMine)} onClick={() => setFilterMine(v => !v)}>👤 自分の担当</button>
          <button style={S.toggleBtn(sortPriority)} onClick={() => setSortPriority(v => !v)}>↑ 優先度順</button>
          {isFiltered && (
            <button onClick={resetFilters} style={{
              border: "1px solid #E2E8F0", borderRadius: 6, padding: "5px 12px",
              fontSize: 12, fontWeight: 600, background: "#F8FAFC", color: "#555555",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            }}>✕ 絞り込みをリセット</button>
          )}
        </div>
      </div>

      <div style={{ ...S.card, overflowX: "auto" }}>
        <table style={{ ...S.table, tableLayout: "auto" as const }}>
          <thead>
            <tr>
              {[
                { label: "#", minWidth: 40 },
                { label: "優先度", minWidth: 70 },
                { label: "タイトル", minWidth: 200 },
                { label: "ページ", minWidth: 160 },
                { label: "ステータス", minWidth: 100 },
                { label: "担当者", minWidth: 80 },
                { label: "起票者", minWidth: 80 },
                { label: "", minWidth: 60 },
              ].map(h => <th key={h.label} style={{ ...S.th, minWidth: h.minWidth }}>{h.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", color: "#888888", padding: 40 }}>条件に一致する修正依頼がありません</td></tr>
            ) : filtered.map(issue => {
              const isDone = doneStatusNames.includes(issue.status);
              const goDetail = () => { setSelected(issue); setView("detail"); };
              const rowGroupId = `issue-row-${issue.id}`;
              return (
                <React.Fragment key={issue.id}>
                <tr data-row-group={rowGroupId} style={{ cursor: "pointer", opacity: isDone ? 0.5 : 1 }}
                  onMouseEnter={() => { document.querySelectorAll(`[data-row-group="${rowGroupId}"]`).forEach(el => (el as HTMLElement).style.background = "#F8FAFC"); }}
                  onMouseLeave={() => { document.querySelectorAll(`[data-row-group="${rowGroupId}"]`).forEach(el => (el as HTMLElement).style.background = ""); }}
                >
                  <td style={{ ...S.td, color: "#888888", fontWeight: 700, fontSize: 12 }} onClick={goDetail}>#{issue.id}</td>
                  <td style={S.td} onClick={goDetail}><PriorityBadge label={issue.priority} /></td>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600, marginBottom: 2, cursor: "pointer" }} onClick={goDetail}>{issue.title}</div>
                    {issue.url && <div style={{ fontSize: 11, color: "#888888", fontFamily: "monospace", cursor: "pointer" }} onClick={goDetail}>{issue.url.replace("https://", "")}</div>}
                    {(issue.screenshot_url || issue.detail) && (
                      <div style={{ display: "flex", gap: 10, marginTop: 6, alignItems: "flex-start" }}>
                        {issue.screenshot_url && (
                          <div style={{ flexShrink: 0, width: 120, height: 80, borderRadius: 4, overflow: "hidden", background: "#0F172A", position: "relative", cursor: "pointer" }}
                            onClick={goDetail}>
                            <img src={issue.screenshot_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            <div style={{ position: "absolute", left: `${issue.x}%`, top: `${issue.y}%`, transform: "translate(-50%,-50%)", width: 16, height: 16, borderRadius: "50%", background: "rgba(239,68,68,0.2)", border: "2px solid #EF4444", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 7, fontWeight: 800 }}>{issue.id}</div>
                          </div>
                        )}
                        {editingDetailId === issue.id ? (
                          <textarea
                            autoFocus
                            value={editingDetailText}
                            onChange={e => setEditingDetailText(e.target.value)}
                            onBlur={() => { updateDetail(issue.id, editingDetailText); setEditingDetailId(null); }}
                            onKeyDown={e => { if (e.key === "Escape") { setEditingDetailId(null); } }}
                            onClick={e => e.stopPropagation()}
                            style={{ flex: 1, minWidth: 0, fontSize: 12, color: "#333333", lineHeight: 1.6, border: "1px solid #93C5FD", borderRadius: 4, padding: "4px 6px", resize: "vertical", minHeight: 48, outline: "none", background: "#EFF6FF" }}
                          />
                        ) : (
                          <div style={{ flex: 1, minWidth: 0, cursor: "pointer", borderRadius: 4, padding: "2px 4px", position: "relative" }}
                            onClick={e => { e.stopPropagation(); setEditingDetailId(issue.id); setEditingDetailText(issue.detail || ""); }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#F1F5F9"; (e.currentTarget.querySelector(".edit-hint-list") as HTMLElement)?.style.setProperty("opacity", "1"); }}
                            onMouseLeave={e => { e.currentTarget.style.background = ""; (e.currentTarget.querySelector(".edit-hint-list") as HTMLElement)?.style.setProperty("opacity", "0"); }}
                          >
                            {issue.detail ? (
                              <div style={{ fontSize: 12, color: "#333333", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{issue.detail}</div>
                            ) : (
                              <div style={{ fontSize: 12, color: "#888888", fontStyle: "italic" }}>詳細を追加...</div>
                            )}
                            <span className="edit-hint-list" style={{ position: "absolute", top: 2, right: 4, opacity: 0, transition: "opacity 0.15s", fontSize: 11, color: "#888888" }}>✏️</span>
                          </div>
                        )}
                      </div>
                    )}
                    {!issue.screenshot_url && !issue.detail && (
                      <div style={{ marginTop: 4 }}>
                        {editingDetailId === issue.id ? (
                          <textarea
                            autoFocus
                            value={editingDetailText}
                            onChange={e => setEditingDetailText(e.target.value)}
                            onBlur={() => { updateDetail(issue.id, editingDetailText); setEditingDetailId(null); }}
                            onKeyDown={e => { if (e.key === "Escape") { setEditingDetailId(null); } }}
                            onClick={e => e.stopPropagation()}
                            style={{ width: "100%", fontSize: 12, color: "#333333", lineHeight: 1.6, border: "1px solid #93C5FD", borderRadius: 4, padding: "4px 6px", resize: "vertical", minHeight: 48, outline: "none", background: "#EFF6FF" }}
                          />
                        ) : (
                          <div style={{ cursor: "pointer", borderRadius: 4, padding: "2px 4px", position: "relative" }}
                            onClick={e => { e.stopPropagation(); setEditingDetailId(issue.id); setEditingDetailText(""); }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#F1F5F9"; (e.currentTarget.querySelector(".edit-hint-list") as HTMLElement)?.style.setProperty("opacity", "1"); }}
                            onMouseLeave={e => { e.currentTarget.style.background = ""; (e.currentTarget.querySelector(".edit-hint-list") as HTMLElement)?.style.setProperty("opacity", "0"); }}
                          >
                            <div style={{ fontSize: 12, color: "#888888", fontStyle: "italic" }}>詳細を追加...</div>
                            <span className="edit-hint-list" style={{ position: "absolute", top: 2, right: 4, opacity: 0, transition: "opacity 0.15s", fontSize: 11, color: "#888888" }}>✏️</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ ...S.td, fontSize: 12, color: "#555555" }} onClick={goDetail}>{issue.page}</td>
                  <td style={{ ...S.td, cursor: "pointer" }} onClick={e => {
                    e.stopPropagation();
                    if (editingStatusId === issue.id) { setEditingStatusId(null); setDropdownPos(null); } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const spaceBelow = window.innerHeight - rect.bottom;
                      if (spaceBelow < 250) {
                        setDropdownPos({ bottom: window.innerHeight - rect.top + 2, left: rect.left });
                      } else {
                        setDropdownPos({ top: rect.bottom + 2, left: rect.left });
                      }
                      setEditingStatusId(issue.id); setEditingAssigneeId(null);
                    }
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F1F5F9")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <StatusBadge label={issue.status} statuses={statuses} />
                      <span style={{ fontSize: 9, color: "#888888", lineHeight: 1 }}>▼</span>
                    </div>
                    {editingStatusId === issue.id && dropdownPos && (
                      <div style={{ position: "fixed", ...(dropdownPos.top != null ? { top: dropdownPos.top } : { bottom: dropdownPos.bottom }), left: dropdownPos.left, zIndex: 9999, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 4, minWidth: 160 }}
                        onClick={e => e.stopPropagation()}>
                        {statuses.map(st => {
                          const c = statusColors(st.color);
                          const active = issue.status === st.name;
                          return (
                            <div key={st.id} onClick={() => { updateStatus(issue.id, st.name); setEditingStatusId(null); setDropdownPos(null); }}
                              style={{ padding: "6px 10px", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 400, color: active ? c.text : "#333333", background: active ? c.bg : "transparent", display: "flex", alignItems: "center", gap: 6 }}
                              onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#F8FAFC"; }}
                              onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                            >
                              <span style={{ fontSize: 8, color: st.color }}>●</span>
                              {active && "✓ "}{st.name}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td style={{ ...S.td, fontSize: 12, cursor: "pointer" }} onClick={e => {
                    e.stopPropagation();
                    if (editingAssigneeId === issue.id) { setEditingAssigneeId(null); setDropdownPos(null); } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const spaceBelow = window.innerHeight - rect.bottom;
                      if (spaceBelow < 250) {
                        setDropdownPos({ bottom: window.innerHeight - rect.top + 2, left: rect.left });
                      } else {
                        setDropdownPos({ top: rect.bottom + 2, left: rect.left });
                      }
                      setEditingAssigneeId(issue.id); setEditingStatusId(null);
                    }
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F1F5F9")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {issue.assignee || <span style={{ color: "#888888" }}>未割当</span>}
                      <span style={{ fontSize: 9, color: "#888888", lineHeight: 1 }}>▼</span>
                    </div>
                    {editingAssigneeId === issue.id && dropdownPos && (
                      <div style={{ position: "fixed", ...(dropdownPos.top != null ? { top: dropdownPos.top } : { bottom: dropdownPos.bottom }), left: dropdownPos.left, zIndex: 9999, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 4, minWidth: 140 }}
                        onClick={e => e.stopPropagation()}>
                        <div onClick={() => { updateAssignee(issue.id, ""); setEditingAssigneeId(null); setDropdownPos(null); }}
                          style={{ padding: "6px 10px", borderRadius: 5, cursor: "pointer", fontSize: 12, color: !issue.assignee ? "#2563EB" : "#888888", fontWeight: !issue.assignee ? 700 : 400 }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >未割当</div>
                        {memberNames.map(n => (
                          <div key={n} onClick={() => { updateAssignee(issue.id, n); setEditingAssigneeId(null); setDropdownPos(null); }}
                            style={{ padding: "6px 10px", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: issue.assignee === n ? 700 : 400, color: issue.assignee === n ? "#2563EB" : "#333333" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >{issue.assignee === n && "✓ "}{n}</div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ ...S.td, fontSize: 12, color: "#555555" }} onClick={goDetail}>{issue.reporter || ""}</td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {issue.url && (
                        <Tooltip text="該当箇所を開く（拡張機能連携）">
                          <a href={buildLocationLink(issue)} target="_blank" rel="noopener noreferrer"
                            style={{ ...S.linkBtn, padding: "3px 8px", fontSize: 11 }} onClick={e => e.stopPropagation()}>📍</a>
                        </Tooltip>
                      )}
                      <span style={{ color: "#DC2626", fontSize: 11, fontWeight: 600, cursor: "pointer", textDecoration: "none" }}
                        onClick={e => { e.stopPropagation(); setShowDelete(issue.id); }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                      >削除</span>
                    </div>
                  </td>
                </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: "#888888" }}>{filtered.length} 件表示 / 全 {issues.length} 件</div>
    </div>
  );

  // ── レンダー ─────────────────────────────────────────────────
  return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ ...S.logo, cursor: "pointer" }} onClick={() => { setView("list"); setSelected(null); fetchMembers(); fetchIssues(); fetchStatuses(); }}><div style={S.logoMark}>✓</div>SiteCheck</div>
          <nav style={S.nav}>
            <button style={S.navBtn(view === "list" || view === "detail")} onClick={() => setView("list")}>修正依頼</button>
            <button style={S.navBtn(view === "members")} onClick={() => setView("members")}>メンバー管理</button>
            <button style={S.navBtn(view === "statuses")} onClick={() => setView("statuses")}>ステータス管理</button>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "#888888" }}>ログイン中：</span>
          <select style={{ ...S.select, background: "#1E293B", color: "#F8FAFC", borderColor: "#334155", fontSize: 12 }}
            value={currentUser} onChange={e => setCurrentUser(e.target.value)}>
            {memberNames.map(n => <option key={n}>{n}</option>)}
          </select>
          {view === "list" && (
            <button style={S.addBtn} onClick={() => { setNewForm({ url: "", title: "", detail: "", priority: "中", assignee: memberNames[0] || "", page: "", reporter: currentUser }); setShowNew(true); }}>
              ＋ 修正依頼を追加
            </button>
          )}
        </div>
      </header>

      <div style={S.main}>
        {view === "list" && ListView()}
        {view === "detail" && DetailView()}
        {view === "members" && MembersView()}
        {view === "statuses" && StatusesView()}
      </div>

      {showDelete && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowDelete(null)}>
          <div style={{ ...S.modalBox, width: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>修正依頼を削除しますか？</div>
            <p style={{ fontSize: 13, color: "#555555", marginBottom: 24 }}>
              「{issues.find(i => i.id === showDelete)?.title}」を削除します。この操作は取り消せません。
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowDelete(null)} style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 18px", background: "#fff", fontSize: 13, cursor: "pointer" }}>キャンセル</button>
              <button onClick={() => deleteIssue(showDelete)} style={{ ...S.addBtn, background: "#DC2626" }}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {showNew && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div style={S.modalBox}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>修正依頼を追加</div>
            <label style={S.formLabel}>タイトル *</label>
            <input style={S.formInput} placeholder="例：ヘッダーのフォントサイズが仕様と異なる"
              value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} />
            <label style={S.formLabel}>対象URL</label>
            <input style={S.formInput} placeholder="https://test.example.com/about"
              value={newForm.url} onChange={e => setNewForm(f => ({ ...f, url: e.target.value }))} />
            <label style={S.formLabel}>ページ名</label>
            <input style={S.formInput} placeholder="ページ名を入力"
              value={newForm.page} onChange={e => setNewForm(f => ({ ...f, page: e.target.value }))} />
            <label style={S.formLabel}>詳細説明</label>
            <textarea style={{ ...S.formInput, minHeight: 80, resize: "vertical" }}
              placeholder="具体的な修正内容を記入してください"
              value={newForm.detail} onChange={e => setNewForm(f => ({ ...f, detail: e.target.value }))} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={S.formLabel}>優先度</label>
                <select style={{ ...S.formInput, marginBottom: 0 }} value={newForm.priority}
                  onChange={e => setNewForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={S.formLabel}>担当者</label>
                <select style={{ ...S.formInput, marginBottom: 0 }} value={newForm.assignee}
                  onChange={e => setNewForm(f => ({ ...f, assignee: e.target.value }))}>
                  {memberNames.map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowNew(false)} style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 18px", background: "#fff", fontSize: 13, cursor: "pointer" }}>キャンセル</button>
              <button onClick={addIssue} style={S.addBtn}>追加する</button>
            </div>
          </div>
        </div>
      )}

      {showMemberForm && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowMemberForm(false)}>
          <div style={{ ...S.modalBox, width: 380 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>{editMember ? "メンバーを編集" : "メンバーを追加"}</div>
            <label style={S.formLabel}>名前 *</label>
            <input style={S.formInput} placeholder="例：田中 太郎（PM）"
              value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))} />
            <label style={S.formLabel}>役割</label>
            <input style={S.formInput} placeholder="例：エンジニア・デザイナー・PM"
              value={memberForm.role} onChange={e => setMemberForm(f => ({ ...f, role: e.target.value }))} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button onClick={() => { setShowMemberForm(false); setEditMember(null); }} style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 18px", background: "#fff", fontSize: 13, cursor: "pointer" }}>キャンセル</button>
              <button onClick={saveMember} style={S.addBtn}>{editMember ? "保存する" : "追加する"}</button>
            </div>
          </div>
        </div>
      )}

      {showStatusForm && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowStatusForm(false)}>
          <div style={{ ...S.modalBox, width: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>{editStatus ? "ステータスを編集" : "ステータスを追加"}</div>
            <label style={S.formLabel}>ステータス名 *</label>
            <input style={S.formInput} placeholder="例：レビュー中"
              value={statusForm.name} onChange={e => setStatusForm(f => ({ ...f, name: e.target.value }))} />
            <label style={S.formLabel}>色</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <input type="color" value={statusForm.color} onChange={e => setStatusForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: 40, height: 34, border: "1px solid #E2E8F0", borderRadius: 6, padding: 2, cursor: "pointer" }} />
              <input style={{ ...S.formInput, marginBottom: 0, flex: 1 }} value={statusForm.color}
                onChange={e => setStatusForm(f => ({ ...f, color: e.target.value }))} placeholder="#DC2626" />
              <StatusBadge label={statusForm.name || "プレビュー"} statuses={[{ id: 0, name: statusForm.name || "プレビュー", color: statusForm.color, order: 0 }]} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button onClick={() => { setShowStatusForm(false); setEditStatus(null); }} style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 18px", background: "#fff", fontSize: 13, cursor: "pointer" }}>キャンセル</button>
              <button onClick={saveStatus} style={S.addBtn}>{editStatus ? "保存する" : "追加する"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
