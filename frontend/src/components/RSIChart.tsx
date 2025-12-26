'use client';

import React from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    AreaChart,
    Area
} from 'recharts';

interface RSIChartProps {
    data: { time: string; rsi: number }[];
}

export default function RSIChart({ data }: RSIChartProps) {
    return (
        <div className="card" style={{ height: '400px', width: '100%', marginTop: '2rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: 600 }}>Relative Strength Index (RSI)</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="rsiGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-forest)" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="var(--accent-forest)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis
                            dataKey="time"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            dy={10}
                        />
                        <YAxis
                            domain={[0, 100]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                        />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: 'var(--shadow-subtle)',
                                padding: '12px'
                            }}
                        />
                        <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Overbought', fill: '#ef4444', fontSize: 10 }} />
                        <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" label={{ position: 'right', value: 'Oversold', fill: '#22c55e', fontSize: 10 }} />
                        <Area
                            type="monotone"
                            dataKey="rsi"
                            stroke="var(--accent-forest)"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#rsiGradient)"
                            dot={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
