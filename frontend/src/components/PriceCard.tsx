import React from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface PriceCardProps {
    symbol: string;
    price: string;
    change?: string;
    isPositive?: boolean;
}

export default function PriceCard({ symbol, price, change, isPositive }: PriceCardProps) {
    return (
        <div className="card glass" style={{ minWidth: '280px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-forest)' }}>{symbol}</span>
                <Activity size={18} color="var(--accent-forest)" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                ${price}
            </div>
            {change && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    color: isPositive ? '#22c55e' : '#ef4444',
                    fontSize: '0.875rem',
                    fontWeight: 600
                }}>
                    {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {change}%
                </div>
            )}
        </div>
    );
}
