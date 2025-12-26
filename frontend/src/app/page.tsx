'use client';

import React, { useEffect, useState } from 'react';
import PriceCard from '@/components/PriceCard';
import RSIChart from '@/components/RSIChart';
import { Search, Bell, User, LayoutDashboard, PieChart, Settings, LogOut } from 'lucide-react';

interface StatsData {
  symbol: string;
  price: number;
  rsi: number | null;
  timestamp: number;
}

export default function Home() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [history, setHistory] = useState<{ time: string; rsi: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${baseUrl}/stats`);
      const data = await response.json();

      setStats(data);

      // Update history for the chart
      if (data.rsi !== null) {
        const time = new Date(data.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setHistory(prev => {
          const newHistory = [...prev, { time, rsi: data.rsi }];
          // Keep only the last 20 points
          return newHistory.slice(-20);
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Poll every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside className="glass" style={{ width: '260px', padding: '2rem', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem' }}>
          <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--accent-forest)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>F</div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-forest)' }}>LushFin</span>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'var(--card-background)', color: 'var(--accent-forest)', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
            <LayoutDashboard size={20} /> Dashboard
          </div>
          <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <PieChart size={20} /> Analytics
          </div>
          <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Settings size={20} /> Settings
          </div>
        </nav>

        <div style={{ marginTop: 'auto', padding: '0.75rem 1rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <LogOut size={20} /> Logout
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '2rem 3rem', backgroundColor: 'var(--background)' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800 }}>Fintech Dashboard</h1>
            <p style={{ color: '#6b7280' }}>Welcome back! Here&apos;s what&apos;s happening today.</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Search assets..."
                style={{ padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', outline: 'none', backgroundColor: 'white' }}
              />
            </div>
            <div className="glass" style={{ padding: '10px', borderRadius: '10px', cursor: 'pointer' }}><Bell size={20} /></div>
            <div className="glass" style={{ padding: '10px', borderRadius: '10px', cursor: 'pointer' }}><User size={20} /></div>
          </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <PriceCard
            symbol={stats?.symbol || "BTC / USDT"}
            price={stats ? Number(stats.price).toLocaleString() : "Loading..."}
            change={stats?.rsi ? (stats.rsi > 50 ? "+2.4" : "-1.2") : "0.0"}
            isPositive={stats?.rsi ? stats.rsi > 50 : true}
          />
          <PriceCard symbol="ETH / USDT" price="3,452.12" change="1.2" isPositive={true} />
          <PriceCard symbol="SOL / USDT" price="145.67" change="4.5" isPositive={false} />
        </section>

        <RSIChart data={history.length > 0 ? history : [{ time: 'N/A', rsi: 50 }]} />
      </main>
    </div>
  );
}
