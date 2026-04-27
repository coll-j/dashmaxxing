"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Plotly doesn't play nice with SSR
const Plot = dynamic(() => import('react-plotly.js'), { 
    ssr: false,
    loading: () => <div className="flex-center" style={{ height: '100%', opacity: 0.5 }}>Rendering...</div>
});

interface ChartWidgetProps {
    chart: {
        id: number;
        title: string;
        type: string;
        sql_query: string;
    };
}

export default function ChartWidget({ chart }: ChartWidgetProps) {
    const [data, setData] = useState<any[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsLoading(true);
        fetch(`http://localhost:8000/api/dashboards/charts/${chart.id}/data`)
            .then(res => res.json())
            .then(json => {
                if (json.data) {
                    setData(json.data);
                } else {
                    setError("No data returned");
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError("Failed to fetch data");
                setIsLoading(false);
            });
    }, [chart.id]);

    if (isLoading) {
        return (
            <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Loading {chart.title}...</div>
                {/* Minimal CSS skeleton */}
                <div style={{ width: '80%', height: '4px', background: 'var(--color-surface-hover)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div className="skeleton-progress" style={{ height: '100%', background: 'var(--color-brand)', width: '30%' }}></div>
                </div>
            </div>
        );
    }

    if (error) return <div className="flex-center" style={{ height: '100%', color: 'var(--color-text-error)', fontSize: '0.9rem' }}>{error}</div>;

    // Transform raw rows into Plotly format
    // Basic mapping: assume the first column is X, others are Y
    const xKey = data && data.length > 0 ? Object.keys(data[0])[0] : '';
    const yKeys = data && data.length > 0 ? Object.keys(data[0]).slice(1) : [];

    const plotlyData = yKeys.map(key => ({
        x: data?.map(row => row[xKey]),
        y: data?.map(row => row[key]),
        type: chart.type === 'pie' ? 'pie' : (chart.type === 'bar' ? 'bar' : 'scatter'),
        name: key,
        marker: { color: 'var(--color-brand)' },
        line: { shape: 'spline', color: 'var(--color-brand)' }
    }));

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{chart.title}</span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
                <Plot
                    data={plotlyData}
                    layout={{
                        autosize: true,
                        margin: { l: 40, r: 20, t: 20, b: 40 },
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                        font: { color: 'rgba(255,255,255,0.6)', size: 10 },
                        showlegend: false,
                        xaxis: { gridcolor: 'rgba(255,255,255,0.05)', zeroline: false },
                        yaxis: { gridcolor: 'rgba(255,255,255,0.05)', zeroline: false }
                    }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false }}
                />
            </div>
        </div>
    );
}
