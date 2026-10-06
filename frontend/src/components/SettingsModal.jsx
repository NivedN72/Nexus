import React, { useState } from 'react';
import { X, Save, Settings, Cloud, Key, Check } from 'lucide-react';
import { DEFAULT_CONFIG, setConfig } from '../config';

export default function SettingsModal({ isOpen, onClose }) {
  const getStoredUrl = () => {
    const u = localStorage.getItem('nexus_api_url');
    return (u && !u.includes('k65kqaeq')) ? u : DEFAULT_CONFIG.apiBaseUrl;
  };

  const getStoredPoolId = () => {
    const p = localStorage.getItem('nexus_pool_id');
    return (p && !p.includes('xxxx')) ? p : DEFAULT_CONFIG.cognito.userPoolId;
  };

  const getStoredClientId = () => {
    const c = localStorage.getItem('nexus_client_id');
    return (c && !c.includes('xxxx')) ? c : DEFAULT_CONFIG.cognito.clientId;
  };

  const [apiUrl, setApiUrl] = useState(getStoredUrl());
  const [poolId, setPoolId] = useState(getStoredPoolId());
  const [clientId, setClientId] = useState(getStoredClientId());
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    setConfig({
      apiBaseUrl: apiUrl.trim().replace(/\/$/, ''),
      userPoolId: poolId.trim(),
      clientId: clientId.trim(),
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
      window.location.reload();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-lg rounded-2xl p-6 border border-white/10 shadow-2xl relative">
        
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 flex items-center justify-center text-indigo-400">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">AWS Configuration Settings</h2>
            <p className="text-xs text-slate-400">Live endpoint targeting for your AWS deployment</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-cyan-400" />
              API Gateway Invoke URL
            </label>
            <input
              type="url"
              placeholder="https://xxxx.execute-api.ap-southeast-2.amazonaws.com/prod"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 font-mono text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">Must include stage name at the end (e.g. <code>/prod</code>)</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              Cognito User Pool ID
            </label>
            <input
              type="text"
              placeholder="ap-southeast-2_xxxxxxxxx"
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 font-mono text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              Cognito App Client ID
            </label>
            <input
              type="text"
              placeholder="26-character random client id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 font-mono text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                saved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
              }`}
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" /> Saved! Reloading...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Configuration
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
