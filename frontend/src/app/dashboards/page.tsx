"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";

export default function DashboardsHub() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { data: session } = useSession();
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (session?.user) {
      fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.user.email,
          name: session.user.name,
          google_id: (session.user as any).id
        })
      })
      .then(res => res.json())
      .then(data => setUserProfile(data))
      .catch(console.error);
    }
  }, [session]);

  useEffect(() => {
    fetch("http://localhost:8000/api/dashboards/")
      .then(res => res.json())
      .then(data => {
        setDashboards(Array.isArray(data) ? data : []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setDashboards([]);
        setIsLoading(false);
      });
  }, []);

  const handleCreateNewClick = () => {
    if (!session) {
      alert("You must be logged in to create a dashboard.");
      return;
    }
    if (!userProfile) {
      alert("Loading profile, please wait...");
      return;
    }
    
    if (!userProfile.org_id) {
      setIsOrgModalOpen(true);
    } else {
      setIsWizardOpen(true);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', paddingTop: '4rem' }}>
      <div className="flex-between" style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.03em' }}>Dashboards</h1>
        <button
          className="btn btn-primary"
          onClick={handleCreateNewClick}
          style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', borderRadius: '12px' }}
        >
          + Create New
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>Loading your dashboards...</div>
      ) : dashboards.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '6rem 2rem', borderRadius: '24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--color-surface-hover)', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Dashboards Yet</h3>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
            Create your first AI-generated dashboard by securely selecting the databases or spreadsheets you want to visualize.
          </p>
          <button className="btn btn-primary" onClick={handleCreateNewClick}>Create First Dashboard</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {dashboards.map((dash: any) => (
            <a key={dash.id} href={`/dashboards/${dash.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="glass-panel card-hover" style={{ padding: '2rem', borderRadius: '20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>{dash.name}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>/{dash.slug}</p>
                </div>
                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '100px', background: 'var(--color-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&rarr;</div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {isOrgModalOpen && (
        <OrgOnboardingModal 
          userProfile={userProfile} 
          close={() => setIsOrgModalOpen(false)} 
          onSuccess={(updatedProfile) => {
            setUserProfile(updatedProfile);
            setIsOrgModalOpen(false);
            setIsWizardOpen(true);
          }} 
        />
      )}

      {isWizardOpen && userProfile && (
        <CreationWizard close={() => setIsWizardOpen(false)} orgId={userProfile.org_id} />
      )}
    </div>
  );
}

const MOCK_TABLES = [
  { name: 'users', columns: ['id', 'email', 'name', 'created_at', 'updated_at', 'role', 'status'] },
  { name: 'subscriptions', columns: ['id', 'user_id', 'plan', 'status', 'started_at', 'expires_at'] },
  { name: 'payments', columns: ['id', 'user_id', 'amount', 'currency', 'status', 'created_at', 'stripe_id'] },
  { name: 'events', columns: ['id', 'user_id', 'type', 'payload', 'occurred_at', 'source'] },
];

function CreationWizard({ close, orgId }: { close: () => void, orgId: number }) {
  // steps: 'CONNECT', 'SELECT_TABLES', 'QA'
  const [step, setStep] = useState('CONNECT');
  const router = useRouter();
  const [history, setHistory] = useState([
    { role: 'model', parts: 'Hi! I\'ve loaded the schema. What specific questions are you trying to answer today?' }
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isGenerating]);

  const toggleTable = (name: string) =>
    setExpandedTables(prev => ({ ...prev, [name]: !prev[name] }));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;
    const newHistory = [...history, { role: 'user', parts: input }];
    setHistory(newHistory);
    setInput('');
    setIsGenerating(true);

    try {
      const res = await fetch("http://localhost:8000/api/ai/chat", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: newHistory,
          schema_context: { tables: ['users', 'payments'], explanation: "Mock DB injected" }
        })
      });
      const data = await res.json();
      setHistory([...newHistory, { role: 'model', parts: data.reply }]);
    } catch (err) {
      console.error(err);
      setHistory([...newHistory, { role: 'model', parts: 'Error: Failed to connect to Gemini backend.' }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("http://localhost:8000/api/ai/generate", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history,
          schema_context: { tables: ['users', 'payments'] },
          org_id: orgId,    // Passed dynamically from user profile
          source_id: 1  // Placeholder: In prod would come from selection
        })
      });
      const data = await res.json();
      if (data.dashboard_id) {
        router.push(`/dashboards/${data.dashboard_id}`);
      } else {
        alert("Generation failed: " + (data.error || "Unknown error") + "\n" + data.detail);
      }
    } catch (err) {
      console.error(err);
      alert("Error reaching generation API");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(5, 5, 10, 0.8)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '750px', height: '85vh', maxHeight: '800px', padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>

        {/* Wizard Header */}
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Dashboard Creator</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
              {step === 'CONNECT' ? 'Select or connect multiple data sources' : step === 'SELECT_TABLES' ? 'Select specific tables and tabs' : 'AI Onboarding Generation'}
            </p>
          </div>
          <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '0.5rem' }}>✕</button>
        </div>

        {/* Wizard Body Container */}
        <div style={{ padding: '2rem', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {step === 'CONNECT' && (
            <div>
              <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>You can select multiple sources across your Organization concurrently.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                {['Production Postgres', 'Q1 Marketing (Google Sheet)'].map((name, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: 'var(--color-brand)' }} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{i === 0 ? 'PostgreSQL Database' : 'Google Spreadsheets'}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '1.5rem' }}>
                <button className="btn flex-center" style={{ width: '100%', background: 'transparent', border: '1px dashed var(--color-text-secondary)', color: 'var(--color-text-secondary)', padding: '1rem' }}>
                  + Connect a New Data Source
                </button>
              </div>
            </div>
          )}

          {step === 'SELECT_TABLES' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <h3 style={{ marginBottom: '0.5rem', fontWeight: 500 }}>Select relevant Tables mapping to "Production Postgres"</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Only the schema of selected tables will be sent to the AI. No raw data is ever read.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
                {MOCK_TABLES.map(table => (
                  <div key={table.name} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    {/* Table header row */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem 1rem', cursor: 'pointer' }}>
                      <input type="checkbox" style={{ accentColor: 'var(--color-brand)', width: '16px', height: '16px', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, flex: 1 }}>Table: <code style={{ color: 'var(--color-accent)', fontWeight: 400 }}>{table.name}</code></span>
                      <button
                        type="button"
                        onClick={e => { e.preventDefault(); toggleTable(table.name); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        {expandedTables[table.name] ? '▲' : '▼'} {table.columns.length} fields
                      </button>
                    </label>

                    {/* Expandable column list */}
                    {expandedTables[table.name] && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', maxHeight: '160px', overflowY: 'auto', padding: '0.5rem 1rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {table.columns.map(col => (
                          <span key={col} style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '4px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                            {col}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'QA' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                <button onClick={() => setStep('SELECT_TABLES')} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  &larr; Back to Data Scope
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0, background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>

                {history.map((msg, i) => (
                  msg.role === 'model' ? (
                    <div key={i} style={{ maxWidth: '80%', background: 'rgba(99, 102, 241, 0.15)', padding: '1rem', borderRadius: '12px 12px 12px 0', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                      <p style={{ fontSize: '0.95rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{msg.parts}</p>
                    </div>
                  ) : (
                    <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '80%', background: 'var(--color-brand)', padding: '1rem', borderRadius: '12px 12px 0 12px', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)' }}>
                      <p style={{ fontSize: '0.95rem', color: 'white', whiteSpace: 'pre-wrap' }}>{msg.parts}</p>
                    </div>
                  )
                ))}

                {isGenerating && (
                  <div style={{ maxWidth: '80%', padding: '1rem', opacity: 0.7 }}>
                    <p style={{ fontSize: '0.95rem' }}>Thinking...</p>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
              {/* Chat Input */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your answer… (Shift+Enter for new line)"
                  rows={1}
                  style={{
                    flex: 1, padding: '0.9rem 1rem',
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: '12px', color: '#fff', outline: 'none',
                    resize: 'none', lineHeight: 1.5, fontFamily: 'inherit', fontSize: '0.95rem',
                    maxHeight: '8rem', overflowY: 'auto'
                  }}
                  disabled={isGenerating}
                />
                <button onClick={handleSend} disabled={isGenerating} className="btn btn-primary" style={{ padding: '0.9rem 1.5rem', borderRadius: '12px', flexShrink: 0 }}>
                  Send
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer */}
        <div style={{ padding: '1.25rem 2rem', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {(step === 'SELECT_TABLES' || step === 'QA') && (
              <button className="btn" onClick={() => setStep(step === 'QA' ? 'SELECT_TABLES' : 'CONNECT')} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'white', padding: '0.5rem 1.25rem' }}>Back</button>
            )}
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              {step === 'CONNECT' ? 'Step 1 of 3' : step === 'SELECT_TABLES' ? 'Step 2 of 3' : 'Final Step'}
            </span>
          </div>

          {step !== 'QA' ? (
            <button
              className="btn btn-primary"
              onClick={() => setStep(step === 'CONNECT' ? 'SELECT_TABLES' : 'QA')}
              style={{ padding: '0.75rem 2rem' }}
            >
              {step === 'CONNECT' ? 'Continue' : 'Start Onboarding Phase'}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              style={{ padding: '0.75rem 2rem', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', border: 'none' }}
              disabled={isGenerating}
            >
              {isGenerating ? 'Processing...' : 'Generate Dashboard'}
            </button>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.97) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}} />
    </div>
  )
}

function OrgOnboardingModal({ userProfile, close, onSuccess }: { userProfile: any, close: () => void, onSuccess: (profile: any) => void }) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        const res = await fetch("http://localhost:8000/api/orgs/", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: inputValue, user_id: userProfile.id })
        });
        if (!res.ok) throw new Error("Failed to create org");
        const org = await res.json();
        onSuccess({ ...userProfile, org_id: org.id, role: 'Admin' });
      } else {
        const res = await fetch("http://localhost:8000/api/orgs/join", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: parseInt(inputValue), user_id: userProfile.id })
        });
        if (!res.ok) throw new Error("Failed to join org");
        const data = await res.json();
        onSuccess({ ...userProfile, org_id: data.org.id, role: 'Member' });
      }
    } catch (err) {
      console.error(err);
      alert("Action failed. Check console or try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(5, 5, 10, 0.8)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '2.5rem', animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div className="flex-between" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Organization Setup</h2>
          <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>✕</button>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', padding: '0.25rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          <button 
            className="btn" 
            onClick={() => setMode('create')}
            style={{ flex: 1, background: mode === 'create' ? 'var(--color-surface)' : 'transparent', color: mode === 'create' ? 'white' : 'var(--color-text-secondary)' }}
          >
            Create New
          </button>
          <button 
            className="btn" 
            onClick={() => setMode('join')}
            style={{ flex: 1, background: mode === 'join' ? 'var(--color-surface)' : 'transparent', color: mode === 'join' ? 'white' : 'var(--color-text-secondary)' }}
          >
            Join Existing
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
              {mode === 'create' ? 'Organization Name' : 'Organization ID'}
            </label>
            <input 
              type={mode === 'create' ? 'text' : 'number'}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={mode === 'create' ? 'e.g. Acme Corp' : 'Enter Org ID'}
              style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'white', outline: 'none' }}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem' }} disabled={isSubmitting}>
            {isSubmitting ? 'Processing...' : (mode === 'create' ? 'Create Organization' : 'Join Organization')}
          </button>
        </form>
      </div>
    </div>
  );
}
