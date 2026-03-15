import { useState, useMemo, useEffect } from "react";

// ── 定数 ────────────────────────────────────────────────────
const PRIORITIES = ["高", "中", "低"];
const STATUSES = ["未対応", "対応中", "確認待ち", "対応なし", "完了"];

const STATUS_COLOR = {
  "未対応":  { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  "対応中":  { bg: "#FFF7ED", text: "#D97706", border: "#FED7AA" },
  "確認待ち":{ bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
  "対応なし":{ bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" },
  "完了":    { bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" },
};
const PRIORITY_COLOR = {
  "高": { bg: "#FEF2F2", text: "#DC2626" },
  "中": { bg: "#FFFBEB", text: "#D97706" },
  "低": { bg: "#F8FAFC", text: "#64748B" },
};
const PRIORITY_ORDER = { "高": 0, "中": 1, "低": 2 };

const INITIAL_MEMBERS = [
  { id: 1, name: "田中（PM）",         role: "PM" },
  { id: 2, name: "佐藤（エンジニア）", role: "エンジニア" },
  { id: 3, name: "鈴木（デザイナー）", role: "デザイナー" },
  { id: 4, name: "山田（ライター）",   role: "ライター" },
];

const INITIAL_ISSUES = [
  {
    id: 1, url: "https://test.example.com/about",
    title: "ヒーローセクションのフォントサイズが仕様と異なる",
    detail: "デザインカンプではh1が48pxだが実装では40pxになっている。スマホ表示でも確認要。",
    priority: "高", status: "未対応", assignee: "佐藤（エンジニア）",
    reporter: "鈴木（デザイナー）", page: "About",
    x: 34, y: 22, createdAt: "2025-06-10", updatedAt: "2025-06-10",
    comments: [{ author: "鈴木（デザイナー）", text: "カンプのAbout-v3.figを参照してください", date: "2025-06-10" }],
  },
  {
    id: 2, url: "https://test.example.com/",
    title: "CTAボタンのホバー色が未実装",
    detail: "カンプ指定の#2563EBへの変化がなく、デフォルトのまま。",
    priority: "高", status: "対応中", assignee: "佐藤（エンジニア）",
    reporter: "田中（PM）", page: "トップ",
    x: 60, y: 45, createdAt: "2025-06-09", updatedAt: "2025-06-11",
    comments: [{ author: "佐藤（エンジニア）", text: "確認しました。本日中に対応します", date: "2025-06-11" }],
  },
  {
    id: 3, url: "https://test.example.com/service",
    title: "サービス一覧のカード間隔が不均等",
    detail: "3列グリッドで左端のカードだけgapがずれている。CSSのgrid-gapを確認してほしい。",
    priority: "中", status: "確認待ち", assignee: "鈴木（デザイナー）",
    reporter: "鈴木（デザイナー）", page: "サービス",
    x: 48, y: 60, createdAt: "2025-06-08", updatedAt: "2025-06-12",
    comments: [
      { author: "佐藤（エンジニア）", text: "対応しました。確認お願いします", date: "2025-06-12" },
      { author: "鈴木（デザイナー）", text: "確認中です", date: "2025-06-12" },
    ],
  },
  {
    id: 4, url: "https://test.example.com/contact",
    title: "お問い合わせフォームの送信後リダイレクト先が404",
    detail: "/thanksページが存在しない。エンジニアに作成依頼。",
    priority: "高", status: "完了", assignee: "佐藤（エンジニア）",
    reporter: "山田（ライター）", page: "コンタクト",
    x: 50, y: 80, createdAt: "2025-06-07", updatedAt: "2025-06-11",
    comments: [
      { author: "佐藤（エンジニア）", text: "/thanksページ作成しました", date: "2025-06-10" },
      { author: "山田（ライター）", text: "確認しました。完了です！", date: "2025-06-11" },
    ],
  },
  {
    id: 5, url: "https://test.example.com/",
    title: "OGP画像が設定されていない",
    detail: "トップ・各ページともにog:imageが未設定。SNSシェア時に画像が出ない。",
    priority: "中", status: "未対応", assignee: "田中（PM）",
    reporter: "田中（PM）", page: "トップ",
    x: 20, y: 10, createdAt: "2025-06-11", updatedAt: "2025-06-11",
    comments: [],
  },
  {
    id: 6, url: "https://test.example.com/news",
    title: "ニュース一覧のテキストに誤字",
    detail: "「お知らせ」が「おしらせ」と平仮名になっている箇所が3件ある。",
    priority: "低", status: "対応なし", assignee: "山田（ライター）",
    reporter: "田中（PM）", page: "ニュース",
    x: 30, y: 55, createdAt: "2025-06-11", updatedAt: "2025-06-12",
    comments: [{ author: "佐藤（エンジニア）", text: "CMSの仕様上変更不可のため対応なしとします", date: "2025-06-12" }],
  },
];

// ── 小コンポーネント ─────────────────────────────────────────
const Badge = ({ label, type }) => {
  const c = type === "status" ? STATUS_COLOR[label] : PRIORITY_COLOR[label];
  if (!c) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.text,
      border: type === "status" ? `1px solid ${c.border}` : "none",
      letterSpacing: "0.02em", whiteSpace: "nowrap",
    }}>
      {type === "priority" && <span style={{ fontSize: 8 }}>●</span>}
      {label}
    </span>
  );
};

const Tooltip = ({ children, text }) => {
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

// ── メタタイトル取得フック ────────────────────────────────────
// CORSの関係上プロトタイプでは URL → ページ名をキャッシュする簡易実装
// 実運用では Next.js API Route でサーバーサイド fetch する
function usePageTitle(url) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url || !url.startsWith("http")) return;
    setLoading(true);
    // プロトタイプ: allorigins プロキシ経由で取得を試みる
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const timer = setTimeout(() => {
      fetch(proxy)
        .then(r => r.json())
        .then(data => {
          const match = data.contents?.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (match) setTitle(match[1].trim());
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [url]);

  return { title, loading };
}

// ── 該当箇所リンク生成 ───────────────────────────────────────
function buildLocationLink(issue) {
  // 拡張機能がインストール済みなら sitecheck:// プロトコルで呼び出し
  // 未インストールなら URL + パラメータで開くだけ
  const params = new URLSearchParams({
    sc_id: issue.id,
    sc_x: issue.x,
    sc_y: issue.y,
    sc_title: issue.title,
  });
  return `${issue.url}#${params.toString()}`;
}

// ── メインアプリ ─────────────────────────────────────────────
export default function App() {
  const [issues, setIssues]   = useState(INITIAL_ISSUES);
  const [members, setMembers] = useState(INITIAL_MEMBERS);

  // 現在ログイン中のユーザー（プロトタイプなので選択式）
  const [currentUser, setCurrentUser] = useState(INITIAL_MEMBERS[0].name);

  const [view, setView]       = useState("list"); // list | detail | members
  const [selected, setSelected] = useState(null);
  const [newComment, setNewComment] = useState("");

  // フィルター
  const [filterStatus,   setFilterStatus]   = useState("すべて");
  const [filterPriority, setFilterPriority] = useState("すべて");
  const [filterAssignee, setFilterAssignee] = useState("すべて");
  const [filterUrl,      setFilterUrl]      = useState("すべて");
  const [filterMine,     setFilterMine]     = useState(false);
  const [sortPriority,   setSortPriority]   = useState(false);
  const [searchText,     setSearchText]     = useState("");

  // モーダル
  const [showNew,     setShowNew]     = useState(false);
  const [showDelete,  setShowDelete]  = useState(null); // issue id
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editMember,  setEditMember]  = useState(null); // member obj or null(=new)

  // 新規依頼フォーム
  const [newForm, setNewForm] = useState({
    url: "", title: "", detail: "", priority: "中",
    assignee: "", page: "", reporter: "",
  });
  const { title: fetchedTitle, loading: titleLoading } = usePageTitle(showNew ? newForm.url : "");

  // メンバーフォーム
  const [memberForm, setMemberForm] = useState({ name: "", role: "" });

  // フィルターをすべてリセット
  const resetFilters = () => {
    setFilterStatus("すべて");
    setFilterPriority("すべて");
    setFilterAssignee("すべて");
    setFilterUrl("すべて");
    setFilterMine(false);
    setSortPriority(false);
    setSearchText("");
  };

  const isFiltered = filterStatus !== "すべて" || filterPriority !== "すべて" ||
    filterAssignee !== "すべて" || filterUrl !== "すべて" ||
    filterMine || searchText !== "";

  // ── 派生データ ──────────────────────────────────────────────
  const memberNames = useMemo(() => members.map(m => m.name), [members]);
  const uniqueUrls  = useMemo(() => ["すべて", ...new Set(issues.map(i => i.url))], [issues]);

  const filtered = useMemo(() => {
    let list = [...issues];
    if (filterStatus === "__open__") list = list.filter(i => i.status !== "完了" && i.status !== "対応なし");
    else if (filterStatus !== "すべて") list = list.filter(i => i.status === filterStatus);
    if (filterPriority !== "すべて") list = list.filter(i => i.priority === filterPriority);
    if (filterAssignee !== "すべて") list = list.filter(i => i.assignee === filterAssignee);
    if (filterUrl      !== "すべて") list = list.filter(i => i.url      === filterUrl);
    if (filterMine)  list = list.filter(i => i.assignee === currentUser);
    if (searchText)  list = list.filter(i => i.title.includes(searchText) || i.detail.includes(searchText));
    if (sortPriority) list.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    return list;
  }, [issues, filterStatus, filterPriority, filterAssignee, filterUrl, filterMine, sortPriority, searchText, currentUser]);

  const stats = useMemo(() => ({
    total: issues.length,
    open:  issues.filter(i => i.status !== "完了" && i.status !== "対応なし").length,
    done:  issues.filter(i => i.status === "完了").length,
    high:  issues.filter(i => i.priority === "高" && i.status !== "完了" && i.status !== "対応なし").length,
  }), [issues]);

  // ── アクション ──────────────────────────────────────────────
  const updateStatus = (id, status) => {
    const today = new Date().toISOString().slice(0, 10);
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status, updatedAt: today } : i));
    setSelected(s => s?.id === id ? { ...s, status, updatedAt: today } : s);
  };

  const updateAssignee = (id, assignee) => {
    const today = new Date().toISOString().slice(0, 10);
    setIssues(prev => prev.map(i => i.id === id ? { ...i, assignee, updatedAt: today } : i));
    setSelected(s => s?.id === id ? { ...s, assignee, updatedAt: today } : s);
  };

  const addComment = (id) => {
    if (!newComment.trim()) return;
    const comment = { author: currentUser, text: newComment, date: new Date().toISOString().slice(0, 10) };
    setIssues(prev => prev.map(i => i.id === id ? { ...i, comments: [...i.comments, comment] } : i));
    setSelected(s => ({ ...s, comments: [...s.comments, comment] }));
    setNewComment("");
  };

  const addIssue = () => {
    if (!newForm.title || !newForm.url) return;
    const today = new Date().toISOString().slice(0, 10);
    setIssues(prev => [...prev, {
      ...newForm,
      page: newForm.page || fetchedTitle || "",
      id: Date.now(), status: "未対応",
      x: 50, y: 50,
      reporter: newForm.reporter || currentUser,
      assignee: newForm.assignee || memberNames[0] || "",
      createdAt: today, updatedAt: today, comments: [],
    }]);
    setShowNew(false);
    setNewForm({ url: "", title: "", detail: "", priority: "中", assignee: "", page: "", reporter: "" });
  };

  const deleteIssue = (id) => {
    setIssues(prev => prev.filter(i => i.id !== id));
    setShowDelete(null);
    if (selected?.id === id) { setSelected(null); setView("list"); }
  };

  // メンバー管理
  const saveMember = () => {
    if (!memberForm.name.trim()) return;
    if (editMember) {
      setMembers(prev => prev.map(m => m.id === editMember.id ? { ...m, ...memberForm } : m));
    } else {
      setMembers(prev => [...prev, { id: Date.now(), ...memberForm }]);
    }
    setShowMemberForm(false);
    setEditMember(null);
    setMemberForm({ name: "", role: "" });
  };

  const deleteMember = (id) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  // ── スタイル ─────────────────────────────────────────────────
  const S = {
    app:    { fontFamily: "'IBM Plex Sans JP','Noto Sans JP',sans-serif", background: "#F1F5F9", minHeight: "100vh", color: "#1E293B" },
    header: { background: "#0F172A", color: "#F8FAFC", padding: "0 24px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 },
    logo:   { display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 700 },
    logoMark: { width: 28, height: 28, background: "#3B82F6", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 },
    nav:    { display: "flex", gap: 2 },
    navBtn: (active) => ({
      background: active ? "#1E293B" : "none", color: active ? "#F8FAFC" : "#94A3B8",
      border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600,
      cursor: "pointer", transition: "all 0.15s",
    }),
    main:   { maxWidth: 1200, margin: "0 auto", padding: "20px 24px" },
    statsRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 },
    statCard: (c) => ({ background: "#fff", borderRadius: 8, padding: "14px 18px", borderLeft: `3px solid ${c}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }),
    statNum: { fontSize: 28, fontWeight: 800, lineHeight: 1, marginBottom: 2 },
    statLabel: { fontSize: 11, color: "#94A3B8", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" },
    filterBar: { background: "#fff", borderRadius: 8, padding: "14px 18px", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" },
    select: { border: "1px solid #E2E8F0", borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "#374151", background: "#fff", cursor: "pointer", outline: "none" },
    toggleBtn: (a) => ({ border: `1px solid ${a?"#2563EB":"#E2E8F0"}`, borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, background: a?"#EFF6FF":"#fff", color: a?"#2563EB":"#374151", cursor: "pointer" }),
    input:  { border: "1px solid #E2E8F0", borderRadius: 6, padding: "5px 10px", fontSize: 12, outline: "none", color: "#374151" },
    table:  { width: "100%", borderCollapse: "collapse" },
    th:     { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "2px solid #E2E8F0", background: "#F8FAFC" },
    td:     { padding: "12px 14px", borderBottom: "1px solid #F1F5F9", fontSize: 13, verticalAlign: "middle" },
    addBtn: { display: "flex", alignItems: "center", gap: 6, background: "#2563EB", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
    iconBtn: (color="#64748B") => ({ background: "none", border: "none", cursor: "pointer", color, fontSize: 15, padding: "4px 6px", borderRadius: 4, lineHeight: 1 }),
    sectionLabel: { fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 },
    card:   { background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" },
    modal:  { position: "fixed", inset: 0, background: "rgba(15,23,42,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
    modalBox: { background: "#fff", borderRadius: 10, padding: 28, width: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" },
    formLabel: { fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 },
    formInput: { width: "100%", border: "1px solid #E2E8F0", borderRadius: 6, padding: "7px 10px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14 },
    linkBtn: { display: "inline-flex", alignItems: "center", gap: 4, color: "#2563EB", fontSize: 12, textDecoration: "none", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 5, padding: "4px 10px", fontWeight: 600, cursor: "pointer" },
  };

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
            <tr>
              {["名前", "役割", "担当件数（未完了）", "操作"].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {members.map(m => {
              const count = issues.filter(i => i.assignee === m.name && i.status !== "完了" && i.status !== "対応なし").length;
              return (
                <tr key={m.id}>
                  <td style={S.td}>
                    <span style={{ fontWeight: 600 }}>{m.name}</span>
                    {m.name === currentUser && <span style={{ marginLeft: 6, fontSize: 11, background: "#EFF6FF", color: "#2563EB", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>自分</span>}
                  </td>
                  <td style={{ ...S.td, color: "#64748B" }}>{m.role}</td>
                  <td style={S.td}>
                    <span style={{ fontWeight: 700, color: count > 0 ? "#D97706" : "#94A3B8" }}>{count}</span>
                    <span style={{ color: "#94A3B8", fontSize: 12 }}> 件</span>
                  </td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button style={S.iconBtn("#2563EB")} title="編集" onClick={() => {
                        setEditMember(m); setMemberForm({ name: m.name, role: m.role }); setShowMemberForm(true);
                      }}>✏️</button>
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
          {/* ヘッダー */}
          <div style={{ background: "#0F172A", color: "#fff", padding: "18px 24px" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <Badge label={issue.priority} type="priority" />
              <Badge label={issue.status} type="status" />
              <span style={{ fontSize: 11, color: "#64748B", alignSelf: "center" }}>#{issue.id}</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>{issue.title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#64748B" }}>{issue.url} · {issue.page}</span>
              {/* 該当箇所リンク */}
              <Tooltip text="ブラウザ拡張がある場合、該当箇所をハイライト表示します">
                <a href={locationLink} target="_blank" rel="noopener noreferrer" style={S.linkBtn}>
                  📍 該当箇所を開く
                </a>
              </Tooltip>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px" }}>
            {/* 左 */}
            <div style={{ padding: 24, borderRight: "1px solid #F1F5F9" }}>
              {/* 位置プレビュー */}
              <div style={{ marginBottom: 24 }}>
                <div style={S.sectionLabel}>指摘箇所プレビュー</div>
                <div style={{ position: "relative", background: "#0F172A", borderRadius: 8, height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#334155", fontSize: 12 }}>スクリーンショット（拡張機能取得後に表示）</span>
                  <div style={{ position: "absolute", left: `${issue.x}%`, top: `${issue.y}%`, transform: "translate(-50%,-50%)" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#EF4444", border: "3px solid #fff", boxShadow: "0 0 0 3px rgba(239,68,68,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800 }}>{issue.id}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={S.sectionLabel}>詳細説明</div>
                <p style={{ fontSize: 14, lineHeight: 1.8, color: "#374151", margin: 0 }}>{issue.detail}</p>
              </div>

              {/* コメント */}
              <div>
                <div style={S.sectionLabel}>コメント ({issue.comments.length})</div>
                {issue.comments.map((c, i) => (
                  <div key={i} style={{ background: "#F8FAFC", borderRadius: 6, padding: "10px 14px", marginBottom: 8, fontSize: 13, lineHeight: 1.6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{c.author}</span>
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>{c.date}</span>
                    </div>
                    <div style={{ color: "#374151" }}>{c.text}</div>
                  </div>
                ))}
                <textarea
                  style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 10px", fontSize: 13, resize: "vertical", minHeight: 72, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                  placeholder="コメントを追加…" value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && e.metaKey) addComment(issue.id); }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>⌘+Enter で送信</span>
                  <button onClick={() => addComment(issue.id)} style={{ ...S.addBtn, fontSize: 12, padding: "7px 14px" }}>送信</button>
                </div>
              </div>
            </div>

            {/* 右：メタ情報 */}
            <div style={{ padding: 24 }}>
              {/* ステータス */}
              <div style={{ marginBottom: 20 }}>
                <div style={S.sectionLabel}>ステータス</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => updateStatus(issue.id, s)} style={{
                      border: `1px solid ${issue.status === s ? STATUS_COLOR[s].border : "#E2E8F0"}`,
                      borderRadius: 6, padding: "8px 12px", textAlign: "left",
                      background: issue.status === s ? STATUS_COLOR[s].bg : "#fff",
                      color: issue.status === s ? STATUS_COLOR[s].text : "#374151",
                      fontSize: 13, fontWeight: issue.status === s ? 700 : 400, cursor: "pointer",
                    }}>
                      {issue.status === s ? "✓ " : ""}{s}
                    </button>
                  ))}
                </div>
              </div>

              {/* 担当者変更 */}
              <div style={{ marginBottom: 20 }}>
                <div style={S.sectionLabel}>担当者</div>
                <select style={{ ...S.formInput, marginBottom: 0 }} value={issue.assignee}
                  onChange={e => updateAssignee(issue.id, e.target.value)}>
                  {memberNames.map(n => <option key={n}>{n}</option>)}
                </select>
              </div>

              {/* メタ情報 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
                {[
                  ["起票者", issue.reporter],
                  ["優先度", issue.priority],
                  ["対象ページ", issue.page],
                  ["作成日", issue.createdAt],
                  ["更新日", issue.updatedAt],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={S.sectionLabel}>{label}</div>
                    <div style={{ fontSize: 13, color: "#1E293B", fontWeight: 500 }}>{val || "—"}</div>
                  </div>
                ))}
              </div>

              {/* 削除 */}
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
      {/* サマリー */}
      {/* サマリーカード：クリックで絞り込み */}
      <div style={S.statsRow}>
        {[
          { label: "総件数",              val: stats.total, color: "#94A3B8", onClick: resetFilters },
          { label: "未完了",              val: stats.open,  color: "#D97706", onClick: () => { resetFilters(); setFilterStatus("__open__"); } },
          { label: "完了済み",            val: stats.done,  color: "#16A34A", onClick: () => { resetFilters(); setFilterStatus("完了"); } },
          { label: "優先度・高（未完了）", val: stats.high,  color: "#DC2626", onClick: () => { resetFilters(); setFilterPriority("高"); setFilterStatus("__open__"); } },
        ].map(({ label, val, color, onClick }) => {
          // アクティブ判定
          const isActive =
            (label === "未完了"              && filterStatus === "__open__" && filterPriority === "すべて") ||
            (label === "完了済み"            && filterStatus === "完了") ||
            (label === "優先度・高（未完了）" && filterPriority === "高" && filterStatus === "__open__");
          return (
            <div key={label} onClick={onClick} style={{
              ...S.statCard(color),
              cursor: "pointer",
              outline: isActive ? `2px solid ${color}` : "none",
              outlineOffset: 2,
              transition: "box-shadow 0.15s, outline 0.15s",
              userSelect: "none",
            }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"}
            >
              <div style={{ ...S.statNum, color }}>{val}</div>
              <div style={{ ...S.statLabel, display: "flex", alignItems: "center", gap: 4 }}>
                {label}
                {label !== "総件数" && <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* フィルター */}
      <div style={S.filterBar}>
        <input style={{ ...S.input, width: 200 }} placeholder="🔍 タイトル・内容を検索"
          value={searchText} onChange={e => setSearchText(e.target.value)} />
        <select style={S.select} value={filterStatus === "__open__" ? "__open__" : filterStatus}
          onChange={e => setFilterStatus(e.target.value)}>
          <option value="すべて">すべて</option>
          <option value="__open__">未完了（全ステータス）</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={S.select} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option>すべて</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        <select style={S.select} value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
          <option>すべて</option>{memberNames.map(m => <option key={m}>{m}</option>)}
        </select>
        <select style={{ ...S.select, maxWidth: 220 }} value={filterUrl} onChange={e => setFilterUrl(e.target.value)}>
          <option>すべて</option>
          {uniqueUrls.filter(u => u !== "すべて").map(u => <option key={u}>{u.replace("https://","")}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button style={S.toggleBtn(filterMine)}   onClick={() => setFilterMine(v => !v)}>👤 自分の担当</button>
          <button style={S.toggleBtn(sortPriority)} onClick={() => setSortPriority(v => !v)}>↑ 優先度順</button>
          {isFiltered && (
            <button onClick={resetFilters} style={{
              border: "1px solid #E2E8F0", borderRadius: 6, padding: "5px 12px",
              fontSize: 12, fontWeight: 600, background: "#F8FAFC", color: "#64748B",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            }}>
              ✕ 絞り込みをリセット
            </button>
          )}
        </div>
      </div>

      {/* テーブル */}
      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>{["#","優先度","タイトル","ページ","ステータス","担当者","更新日",""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", color: "#94A3B8", padding: 40 }}>条件に一致する修正依頼がありません</td></tr>
            ) : filtered.map(issue => {
              const isDone = issue.status === "完了" || issue.status === "対応なし";
              return (
                <tr key={issue.id}
                  style={{ cursor: "pointer", opacity: isDone ? 0.5 : 1, transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                  onMouseLeave={e => e.currentTarget.style.background = ""}
                >
                  <td style={{ ...S.td, color: "#94A3B8", fontWeight: 700, fontSize: 12 }} onClick={() => { setSelected(issue); setView("detail"); }}>#{issue.id}</td>
                  <td style={S.td} onClick={() => { setSelected(issue); setView("detail"); }}><Badge label={issue.priority} type="priority" /></td>
                  <td style={S.td} onClick={() => { setSelected(issue); setView("detail"); }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{issue.title}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: "monospace" }}>{issue.url.replace("https://","")}</div>
                  </td>
                  <td style={{ ...S.td, fontSize: 12, color: "#64748B" }} onClick={() => { setSelected(issue); setView("detail"); }}>{issue.page}</td>
                  <td style={S.td} onClick={() => { setSelected(issue); setView("detail"); }}><Badge label={issue.status} type="status" /></td>
                  <td style={{ ...S.td, fontSize: 12 }} onClick={() => { setSelected(issue); setView("detail"); }}>{issue.assignee}</td>
                  <td style={{ ...S.td, fontSize: 12, color: "#94A3B8" }} onClick={() => { setSelected(issue); setView("detail"); }}>{issue.updatedAt}</td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <Tooltip text="該当箇所を開く（拡張機能連携）">
                        <a href={buildLocationLink(issue)} target="_blank" rel="noopener noreferrer"
                          style={{ ...S.linkBtn, padding: "3px 8px", fontSize: 11 }}
                          onClick={e => e.stopPropagation()}>
                          📍
                        </a>
                      </Tooltip>
                      <button style={S.iconBtn("#DC2626")} title="削除"
                        onClick={e => { e.stopPropagation(); setShowDelete(issue.id); }}>🗑</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: "#94A3B8" }}>{filtered.length} 件表示 / 全 {issues.length} 件</div>
    </div>
  );

  // ── レンダー ─────────────────────────────────────────────────
  return (
    <div style={S.app}>
      {/* ヘッダー */}
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={S.logo}><div style={S.logoMark}>✓</div>SiteCheck</div>
          <nav style={S.nav}>
            <button style={S.navBtn(view === "list" || view === "detail")} onClick={() => setView("list")}>修正依頼</button>
            <button style={S.navBtn(view === "members")} onClick={() => setView("members")}>メンバー管理</button>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "#64748B" }}>ログイン中：</span>
          <select style={{ ...S.select, background: "#1E293B", color: "#F8FAFC", borderColor: "#334155", fontSize: 12 }}
            value={currentUser} onChange={e => setCurrentUser(e.target.value)}>
            {memberNames.map(n => <option key={n}>{n}</option>)}
          </select>
          {view === "list" && (
            <button style={S.addBtn} onClick={() => { setNewForm({ url:"",title:"",detail:"",priority:"中",assignee:memberNames[0]||"",page:"",reporter:currentUser }); setShowNew(true); }}>
              ＋ 修正依頼を追加
            </button>
          )}
        </div>
      </header>

      {/* メイン */}
      <div style={S.main}>
        {view === "list"    && <ListView />}
        {view === "detail"  && <DetailView />}
        {view === "members" && <MembersView />}
      </div>

      {/* 削除確認モーダル */}
      {showDelete && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowDelete(null)}>
          <div style={{ ...S.modalBox, width: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>修正依頼を削除しますか？</div>
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>
              「{issues.find(i => i.id === showDelete)?.title}」を削除します。この操作は取り消せません。
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowDelete(null)} style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 18px", background: "#fff", fontSize: 13, cursor: "pointer" }}>キャンセル</button>
              <button onClick={() => deleteIssue(showDelete)} style={{ ...S.addBtn, background: "#DC2626" }}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {/* 新規追加モーダル */}
      {showNew && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div style={S.modalBox}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>修正依頼を追加</div>
            <label style={S.formLabel}>タイトル *</label>
            <input style={S.formInput} placeholder="例：ヘッダーのフォントサイズが仕様と異なる"
              value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} />

            <label style={S.formLabel}>対象URL *</label>
            <input style={S.formInput} placeholder="https://test.example.com/about"
              value={newForm.url} onChange={e => setNewForm(f => ({ ...f, url: e.target.value }))} />

            <label style={S.formLabel}>
              ページ名
              {titleLoading && <span style={{ marginLeft: 8, fontSize: 11, color: "#94A3B8" }}>取得中…</span>}
              {!titleLoading && fetchedTitle && !newForm.page && (
                <span style={{ marginLeft: 8, fontSize: 11, color: "#16A34A" }}>✓ 自動取得: {fetchedTitle}</span>
              )}
            </label>
            <input style={S.formInput} placeholder="URLから自動取得します（手動入力も可）"
              value={newForm.page || fetchedTitle}
              onChange={e => setNewForm(f => ({ ...f, page: e.target.value }))} />

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

      {/* メンバー追加・編集モーダル */}
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
    </div>
  );
}
