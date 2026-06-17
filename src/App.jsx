import { useState, useEffect, useRef } from 'react';

function App() {
  const [wsStatus, setWsStatus] = useState('connecting');
  const [nodes, setNodes] = useState({
    'node-us-east-1': {
      nodeId: 'node-us-east-1',
      name: 'US-Anchor-PC',
      region: 'us',
      isOnline: false,
      isAttested: true,
      specs: { cpu: 'Core i9 16-Core', gpu: 'RTX 4090 24GB', ram: '32GB DDR5' },
      telemetry: { cpuTemp: 42, cpuUsage: 0, ramUsed: 0, vramUsed: 0 }
    },
    'node-in-south-1': {
      nodeId: 'node-in-south-1',
      name: 'India-VPS-Edge',
      region: 'in',
      isOnline: false,
      isAttested: true,
      specs: { cpu: 'EPYC 8-Core', gpu: 'Tesla T4 16GB', ram: '16GB DDR4' },
      telemetry: { cpuTemp: 48, cpuUsage: 0, ramUsed: 0, vramUsed: 0 }
    }
  });
  const [activeTasks, setActiveTasks] = useState([]);
  const [barterLedger, setBarterLedger] = useState({
    'node-us-east-1': 12.4,
    'node-in-south-1': -12.4
  });
  const [logHistory, setLogHistory] = useState(['Initializing local telemetry agent...']);
  const [isAgentConnected, setIsAgentConnected] = useState(true);
  
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Connection config
  const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'ws://localhost:3010';
  const FALLBACK_URL = 'ws://localhost:3060';

  const addLog = (message) => {
    const time = new Date().toLocaleTimeString();
    setLogHistory((prev) => [`[${time}] ${message}`, ...prev.slice(0, 15)]);
  };

  const toggleAgentConnection = () => {
    const nextState = !isAgentConnected;
    setIsAgentConnected(nextState);
    addLog(`Sending manual ${nextState ? 'CONNECT' : 'DISCONNECT'} command to local agent...`);
    
    try {
      const localWs = new WebSocket('ws://localhost:3060');
      localWs.onopen = () => {
        localWs.send(JSON.stringify({ type: 'connection:toggle', state: nextState }));
        setTimeout(() => localWs.close(), 200);
      };
    } catch (err) {
      console.error('Failed to send toggle to local agent:', err);
    }
  };

  const connectWebSocket = (url = ORCHESTRATOR_URL) => {
    setWsStatus('connecting');
    addLog(`Connecting to control plane: ${url}...`);

    if (socketRef.current) {
      socketRef.current.close();
    }

    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      setWsStatus('online');
      addLog(`Connected successfully to ${url === ORCHESTRATOR_URL ? 'Cloud Orchestrator' : 'Local Fallback Host'}`);
    };

    ws.onclose = () => {
      setWsStatus('offline');
      addLog('Disconnected from orchestrator server.');
      
      // Attempt to auto-reconnect after 4s
      reconnectTimeoutRef.current = setTimeout(() => {
        // If main fails, try connecting to local fallback agent
        if (url === ORCHESTRATOR_URL) {
          addLog('Orchestrator down. Attempting local agent fallback...');
          connectWebSocket(FALLBACK_URL);
        } else {
          connectWebSocket(ORCHESTRATOR_URL);
        }
      }, 4000);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'network:state') {
          setNodes(payload.state.nodes);
          setBarterLedger(payload.state.barterLedger);
          setActiveTasks(payload.state.activeTasks || []);
        } else if (payload.type === 'telemetry:broadcast') {
          setNodes(payload.nodes);
          setActiveTasks(payload.activeTasks || []);
        }
      } catch (err) {
        console.error('Error parsing packet data:', err);
      }
    };
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  const triggerExperiment = (mode) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'experiment:trigger', mode }));
      addLog(`Triggering experiment workload: ${mode === 'baseline' ? 'Standalone Failure Test' : 'Distributed Krako Swap'}`);
    } else {
      addLog('Action failed: Control Plane is currently offline.');
    }
  };

  const getPercentageColor = (val) => {
    if (val > 85) return 'high';
    return '';
  };

  return (
    <div className="app-container">
      {/* Dashboard Header */}
      <header className="dashboard-header">
        <div>
          <h1 style={{ fontSize: '2rem', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            KRAKO ORCHESTRATOR
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Time-Zone Compute Barter Network Control Terminal
          </p>
        </div>
        <div className="header-status">
          <div className="status-indicator">
            <span className={`status-dot ${wsStatus === 'online' ? '' : wsStatus === 'offline' ? 'offline' : 'connecting'}`}></span>
            <span style={{ textTransform: 'capitalize' }}>
              Control Plane: {wsStatus === 'online' ? 'Online' : wsStatus === 'offline' ? 'Offline' : 'Connecting'}
            </span>
          </div>
        </div>
      </header>

      {/* Mutual Swap Active Glowing Indicator */}
      {nodes['node-us-east-1']?.isOnline && nodes['node-in-south-1']?.isOnline ? (
        <div style={{
          background: 'rgba(0, 242, 255, 0.03)',
          border: '1px solid rgba(0, 242, 255, 0.25)',
          boxShadow: '0 0 15px rgba(0, 242, 255, 0.08)',
          borderRadius: '12px',
          padding: '0.8rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.8rem',
          animation: 'pulse 2s infinite',
          fontFamily: 'Outfit, sans-serif',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'var(--accent-primary)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase'
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', boxShadow: '0 0 8px var(--accent-primary)' }}></span>
          Mutual Computational Barter Swap Link Active
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', boxShadow: '0 0 8px var(--accent-primary)' }}></span>
        </div>
      ) : (
        <div style={{
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px dashed rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '0.8rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.8rem',
          fontFamily: 'Outfit, sans-serif',
          fontSize: '0.85rem',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase'
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)' }}></span>
          Barter Link Offline (Waiting for Peer Connection)
        </div>
      )}

      {/* Nodes Display Grid */}
      <main className="nodes-container">
        {Object.keys(nodes).map((id) => {
          const node = nodes[id];
          const isOnline = node.isOnline;
          return (
            <div key={id} className={`glass-panel node-card ${isOnline ? 'active-node' : 'offline-node'}`}>
              <div className="node-header">
                <div className="node-title-group">
                  <h2 style={{ fontSize: '1.4rem' }}>{node.name}</h2>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {node.nodeId}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {node.telemetry.isBusy && (
                    <span className="node-badge" style={{ borderColor: 'rgba(245,158,11,0.4)', color: 'var(--warning)', background: 'rgba(245,158,11,0.08)' }}>
                      ⚠ BUSY (Gaming/Active)
                    </span>
                  )}
                  <span className={`node-badge ${node.region}`}>{node.region === 'us' ? '🇺🇸 USA' : '🇮🇳 INDIA'}</span>
                  <span className="node-badge" style={{ borderColor: node.isAttested ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)', color: node.isAttested ? 'var(--success)' : 'var(--danger)', background: node.isAttested ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)' }}>
                    {node.isAttested ? '✓ TEE Verified' : 'Unsecured'}
                  </span>
                  {id === 'node-us-east-1' && (
                    <button 
                      onClick={toggleAgentConnection} 
                      className="btn-secondary" 
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', textTransform: 'uppercase', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      {isAgentConnected ? 'Disconnect' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>

              {/* Resource Gauges */}
              <div className="telemetry-grid">
                <div className="gauge-card">
                  <span className="gauge-title">CPU Utilization</span>
                  <span className="gauge-value">{Math.round(node.telemetry.cpuUsage)}%</span>
                  <div className="gauge-bar-container">
                    <div className={`gauge-bar ${getPercentageColor(node.telemetry.cpuUsage)}`} style={{ width: `${node.telemetry.cpuUsage}%` }}></div>
                  </div>
                </div>

                <div className="gauge-card">
                  <span className="gauge-title">VRAM Usage</span>
                  <span className="gauge-value">{(node.telemetry.vramUsed || 0).toFixed(1)} GB</span>
                  {/* Assume standard 16GB limit for visualization */}
                  <div className="gauge-bar-container">
                    <div className={`gauge-bar ${getPercentageColor((node.telemetry.vramUsed / 16) * 100)}`} style={{ width: `${Math.min(100, ((node.telemetry.vramUsed || 0) / 16) * 100)}%` }}></div>
                  </div>
                </div>

                <div className="gauge-card">
                  <span className="gauge-title">Core Temp</span>
                  <span className="gauge-value">{Math.round(node.telemetry.cpuTemp)}°C</span>
                  <div className="gauge-bar-container">
                    <div className={`gauge-bar ${getPercentageColor(((node.telemetry.cpuTemp - 30) / 70) * 100)}`} style={{ width: `${Math.min(100, Math.max(0, ((node.telemetry.cpuTemp - 30) / 70) * 100))}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Node Specifications */}
              <div className="specs-block">
                <div className="spec-item">
                  <span className="spec-label">Processor</span>
                  <span className="spec-value">{node.specs.cpu}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Graphics Card</span>
                  <span className="spec-value">{node.specs.gpu}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">RAM Pool</span>
                  <span className="spec-value">{node.specs.ram}</span>
                </div>
              </div>

              {/* Status footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>Node Status: <strong style={{ color: isOnline ? 'var(--success)' : 'var(--danger)' }}>{isOnline ? 'ONLINE' : 'OFFLINE'}</strong></span>
                <span>Active swap connection</span>
              </div>
            </div>
          );
        })}
      </main>

      {/* Control Console & Experiments Section */}
      <section className="control-grid">
        {/* Left: Barter and Run Actions */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}>Network Control Console</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>US Node Balance</p>
              <h3 style={{ fontSize: '1.5rem', color: barterLedger['node-us-east-1'] >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: '0.2rem' }}>
                {barterLedger['node-us-east-1'] >= 0 ? '+' : ''}{(barterLedger['node-us-east-1'] || 0).toFixed(1)} hrs
              </h3>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>India Node Balance</p>
              <h3 style={{ fontSize: '1.5rem', color: barterLedger['node-in-south-1'] >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: '0.2rem' }}>
                {barterLedger['node-in-south-1'] >= 0 ? '+' : ''}{(barterLedger['node-in-south-1'] || 0).toFixed(1)} hrs
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <button className="btn-primary" onClick={() => triggerExperiment('baseline')} disabled={wsStatus !== 'online'}>
              Run Baseline Crash Test
            </button>
            <button className="btn-primary" style={{ background: 'linear-gradient(135deg, var(--accent-secondary), #3b82f6)' }} onClick={() => triggerExperiment('krako')} disabled={wsStatus !== 'online'}>
              Run Krako Swapped Test
            </button>
          </div>

          <div>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Console Terminal Logs</h3>
            <div className="terminal-block">
              {logHistory.map((log, idx) => (
                <div key={idx} className="terminal-line">{log}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Active Task Monitor */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--accent-secondary)' }}>Active Telemetry tasks</h2>
          
          <div className="task-list">
            {activeTasks.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0', fontSize: '0.9rem' }}>
                No active compute tasks currently running.
              </div>
            ) : (
              activeTasks.map((task) => {
                const isCrashed = task.status.includes('CRASHED');
                const isSuccess = task.status === 'Success';
                return (
                  <div key={task.id} className="task-item">
                    <div className="task-header">
                      <span style={{ fontWeight: '600' }}>{task.name}</span>
                      <span style={{ color: isCrashed ? 'var(--danger)' : isSuccess ? 'var(--success)' : 'var(--accent-primary)' }}>
                        {task.status}
                      </span>
                    </div>
                    <div className="task-progress-bg">
                      <div className={`task-progress-bar ${isCrashed ? 'crashed' : isSuccess ? 'success' : ''}`} style={{ width: `${task.progress}%` }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>Allocated: Node US / Node IN</span>
                      <span>{task.progress}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
