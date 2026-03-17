"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Project = { id: number; code: string; name: string; site_url: string; created_at: string };

const DEFAULT_STATUSES = [
  { name: "未対応", color: "#DC2626", order: 0 },
  { name: "対応中", color: "#D97706", order: 1 },
  { name: "確認待ち", color: "#2563EB", order: 2 },
  { name: "対応なし", color: "#7C3AED", order: 3 },
  { name: "完了", color: "#16A34A", order: 4 },
];

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showDelete, setShowDelete] = useState<number | null>(null);
  const [newForm, setNewForm] = useState({ code: "", name: "", site_url: "" });

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase.from("projects").select("*").order("id", { ascending: false });
    if (data) setProjects(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const addProject = async () => {
    if (!newForm.name.trim() || !newForm.code.trim()) return;
    const code = newForm.code.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { data, error } = await supabase.from("projects").insert({
      code, name: newForm.name.trim(), site_url: newForm.site_url.trim(),
    }).select().single();
    if (error) { alert("エラー: " + error.message); return; }
    if (data) {
      // デフォルトステータスを作成
      await supabase.from("project_statuses").insert(
        DEFAULT_STATUSES.map(s => ({ ...s, project_id: data.id }))
      );
      setProjects(prev => [data, ...prev]);
    }
    setShowNew(false);
    setNewForm({ code: "", name: "", site_url: "" });
  };

  const deleteProject = async (id: number) => {
    await supabase.from("comments").delete().in("issue_id",
      (await supabase.from("issues").select("id").eq("project_id", id)).data?.map((i: any) => i.id) || []
    );
    await supabase.from("issues").delete().eq("project_id", id);
    await supabase.from("project_members").delete().eq("project_id", id);
    await supabase.from("project_statuses").delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
    setProjects(prev => prev.filter(p => p.id !== id));
    setShowDelete(null);
  };

  const S = {
    app: { fontFamily: "'IBM Plex Sans JP','Noto Sans JP',sans-serif", background: "#F1F5F9", minHeight: "100vh", color: "#333333" },
    header: { background: "#0F172A", color: "#F8FAFC", padding: "0 24px", height: 52, display: "flex" as const, alignItems: "center" as const, justifyContent: "space-between" as const, position: "sticky" as const, top: 0, zIndex: 50 },
    logo: { display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 700 },
    logoMark: { width: 28, height: 28, background: "#3B82F6", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 },
    main: { maxWidth: 900, margin: "0 auto", padding: "32px 24px" },
    card: { background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
    table: { width: "100%", borderCollapse: "collapse" as const },
    th: { padding: "10px 14px", textAlign: "left" as const, fontSize: 11, fontWeight: 700, color: "#555555", letterSpacing: "0.06em", textTransform: "uppercase" as const, borderBottom: "2px solid #E2E8F0", background: "#F8FAFC" },
    td: { padding: "12px 14px", borderBottom: "1px solid #F1F5F9", fontSize: 13, verticalAlign: "middle" as const },
    addBtn: { display: "flex", alignItems: "center", gap: 6, background: "#2563EB", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
    modal: { position: "fixed" as const, inset: 0, background: "rgba(15,23,42,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
    modalBox: { background: "#fff", borderRadius: 10, padding: 28, width: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" as const },
    formLabel: { fontSize: 12, fontWeight: 700, color: "#333333", display: "block", marginBottom: 4 },
    formInput: { width: "100%", border: "1px solid #E2E8F0", borderRadius: 6, padding: "7px 10px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const, marginBottom: 14 },
  };

  if (loading) {
    return (
      <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#555555", fontSize: 24 }}>読み込み中...</div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={S.logo}><div style={S.logoMark}>✓</div>SiteCheck</div>
      </header>

      <div style={S.main}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>プロジェクト一覧</h1>
          <button style={S.addBtn} onClick={() => setShowNew(true)}>＋ 新規プロジェクト作成</button>
        </div>

        {projects.length === 0 ? (
          <div style={{ ...S.card, padding: 40, textAlign: "center", color: "#888888" }}>
            プロジェクトがありません。「新規プロジェクト作成」から始めましょう。
          </div>
        ) : (
          <div style={S.card}>
            <table style={S.table}>
              <thead>
                <tr>
                  {["コード", "プロジェクト名", "サイトURL", "作成日", "操作"].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} style={{ cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <td style={{ ...S.td, fontWeight: 700, color: "#2563EB" }} onClick={() => router.push(`/projects/${p.code}`)}>{p.code}</td>
                    <td style={{ ...S.td, fontWeight: 600 }} onClick={() => router.push(`/projects/${p.code}`)}>{p.name}</td>
                    <td style={{ ...S.td, fontSize: 12, color: "#888888", fontFamily: "monospace" }} onClick={() => router.push(`/projects/${p.code}`)}>
                      {p.site_url ? p.site_url.replace("https://", "") : "—"}
                    </td>
                    <td style={{ ...S.td, fontSize: 12, color: "#888888" }} onClick={() => router.push(`/projects/${p.code}`)}>
                      {p.created_at?.slice(0, 10)}
                    </td>
                    <td style={S.td}>
                      <span style={{ color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        onClick={e => { e.stopPropagation(); setShowDelete(p.id); }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                      >削除</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNew && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div style={S.modalBox}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>新規プロジェクト作成</div>
            <label style={S.formLabel}>プロジェクト名 *</label>
            <input style={S.formInput} placeholder="例：コーポレートサイトリニューアル"
              value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
            <label style={S.formLabel}>プロジェクトコード *（英数字・ハイフンのみ）</label>
            <input style={S.formInput} placeholder="例：corporate-site"
              value={newForm.code} onChange={e => setNewForm(f => ({ ...f, code: e.target.value }))} />
            <label style={S.formLabel}>サイトURL</label>
            <input style={S.formInput} placeholder="https://example.com"
              value={newForm.site_url} onChange={e => setNewForm(f => ({ ...f, site_url: e.target.value }))} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button onClick={() => setShowNew(false)} style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 18px", background: "#fff", fontSize: 13, cursor: "pointer" }}>キャンセル</button>
              <button onClick={addProject} style={S.addBtn}>作成する</button>
            </div>
          </div>
        </div>
      )}

      {showDelete && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowDelete(null)}>
          <div style={{ ...S.modalBox, width: 420 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>プロジェクトを削除しますか？</div>
            <p style={{ fontSize: 13, color: "#555555", marginBottom: 24 }}>
              「{projects.find(p => p.id === showDelete)?.name}」と紐づく修正依頼・メンバー・ステータスをすべて削除します。この操作は取り消せません。
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowDelete(null)} style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 18px", background: "#fff", fontSize: 13, cursor: "pointer" }}>キャンセル</button>
              <button onClick={() => deleteProject(showDelete)} style={{ ...S.addBtn, background: "#DC2626" }}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
