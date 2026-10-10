import ModalShell from './ModalShell';
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
    <ModalShell label="Workspace settings" title="Connected to your cloud." description="Keep your Nexus frontend pointed at the right AWS deployment." className="nexus-dialog-settings">
        
        <button
          aria-label="Close workspace settings"
          onClick={onClose}
          className="absolute top-5 right-5 text-muted hover:text-ink transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-accent/30 flex items-center justify-center text-accent-ink">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">AWS Configuration Settings</h2>
            <p className="text-xs text-muted">Live endpoint targeting for your AWS deployment</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1 flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-accent-ink" />
              API Gateway Invoke URL
            </label>
            <input
              type="url"
              placeholder="https://xxxx.execute-api.ap-southeast-2.amazonaws.com/prod"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full bg-soft border border-line rounded-xl px-3.5 py-2 font-mono text-xs text-ink placeholder-muted focus:outline-none focus:border-accent-ink/25"
              required
            />
            <p className="text-[11px] text-muted mt-1">Must include stage name at the end (e.g. <code>/prod</code>)</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-accent-ink" />
              Cognito User Pool ID
            </label>
            <input
              type="text"
              placeholder="ap-southeast-2_xxxxxxxxx"
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
              className="w-full bg-soft border border-line rounded-xl px-3.5 py-2 font-mono text-xs text-ink placeholder-muted focus:outline-none focus:border-accent-ink/25"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-accent-ink" />
              Cognito App Client ID
            </label>
            <input
              type="text"
              placeholder="26-character random client id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-soft border border-line rounded-xl px-3.5 py-2 font-mono text-xs text-ink placeholder-muted focus:outline-none focus:border-accent-ink/25"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
                saved
                  ? 'bg-success/10 text-ink'
                  : 'bg-accent hover:bg-accent text-ink shadow-sm'
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
    </ModalShell>
  );
}
