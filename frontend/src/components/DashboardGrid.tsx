"use client";

import React from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import ChartWidget from './ChartWidget';

// Import grid layout styles
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface Chart {
    id: number;
    title: string;
    type: string;
    layout: any;
}

interface DashboardGridProps {
    charts: Chart[];
    isEditMode: boolean;
    onLayoutChange: (newLayouts: any) => void;
}

export default function DashboardGrid({ charts, isEditMode, onLayoutChange }: DashboardGridProps) {
    // Transform our DB layout into react-grid-layout format
    const layout = charts.map(chart => ({
        i: chart.id.toString(),
        ...chart.layout
    }));

    return (
        <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: layout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xss: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xss: 2 }}
            rowHeight={100}
            isDraggable={isEditMode}
            isResizable={isEditMode}
            margin={[16, 16]}
            onLayoutChange={(current, all) => onLayoutChange(all)}
        >
            {charts.map(chart => (
                <div key={chart.id.toString()} style={{ background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                    <ChartWidget chart={chart} />
                </div>
            ))}
        </ResponsiveGridLayout>
    );
}
