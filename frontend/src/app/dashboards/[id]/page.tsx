"use client";

import React, { useState, useEffect, use } from 'react';
import DashboardGrid from '@/components/DashboardGrid';
import { Layout } from 'react-grid-layout';

interface ChartConfig {
    id: number;
    title: string;
    type: string;
    layout: any;
    sql_query: string;
}

interface DashboardData {
    id: number;
    name: string;
    slug: string;
    charts: ChartConfig[];
}

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentLayouts, setCurrentLayouts] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetch(`http://localhost:8000/api/dashboards/${id}`)
            .then(res => res.json())
            .then(data => {
                setDashboard(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, [id]);

    const handleSaveLayout = async () => {
        if (!currentLayouts) return;
        setIsSaving(true);
        try {
            // Transform react-grid-layout result into our { chartId: layout } map
            const layoutsMap: Record<string, any> = {};
            currentLayouts.lg.forEach((item: any) => {
                layoutsMap[item.i] = {
                    x: item.x,
                    y: item.y,
                    w: item.w,
                    h: item.h
                };
            });

            await fetch(`http://localhost:8000/api/dashboards/${id}/layout`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layouts: layoutsMap })
            });
            setIsEditMode(false);
            alert("Layout saved!");
        } catch (err) {
            console.error(err);
            alert("Failed to save layout");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="flex-center" style={{ height: '100vh' }}>Loading Dashboard...</div>;
    if (!dashboard) return <div className="flex-center" style={{ height: '100vh' }}>Dashboard not found</div>;

    return (
        <div style={{ padding: '2rem', minHeight: '100vh' }}>
            <div className="flex-between" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>{dashboard.name}</h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{dashboard.slug}</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                        className="btn" 
                        onClick={() => setIsEditMode(!isEditMode)}
                        style={{ background: isEditMode ? 'var(--color-surface-hover)' : 'transparent', border: '1px solid var(--color-border)' }}
                    >
                        {isEditMode ? 'Exit Edit Mode' : 'Edit Layout'}
                    </button>
                    {isEditMode && (
                        <button className="btn btn-primary" onClick={handleSaveLayout} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Layout'}
                        </button>
                    )}
                </div>
            </div>

            <DashboardGrid 
                charts={dashboard.charts} 
                isEditMode={isEditMode} 
                onLayoutChange={(all) => setCurrentLayouts(all)}
            />
        </div>
    );
}
