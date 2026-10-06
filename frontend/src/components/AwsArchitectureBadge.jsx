import React, { useState } from 'react';
import { Layers, CheckCircle2, ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';

export default function AwsArchitectureBadge() {
  const [expanded, setExpanded] = useState(false);

  const services = [
    { name: 'Cognito', role: 'RBAC (Student/Admin)', status: 'Active' },
    { name: 'API Gateway', role: 'REST Proxy & Auth', status: 'Active' },
    { name: 'AWS Lambda', role: '7 Serverless Functions', status: 'Active' },
    { name: 'DynamoDB', role: 'Events, Bookings, Items', status: 'Active' },
    { name: 'DynamoDB Streams', role: 'Real-time Event Bridge', status: 'Active' },
    { name: 'S3', role: 'Pre-signed Direct Upload', status: 'Active' },
    { name: 'Rekognition', role: 'AI Computer Vision', status: 'Active' },
    { name: 'Amazon SNS', role: 'Email Match Alerts', status: 'Active' },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm sm:max-w-md">
      <div className="glass-card rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-xl">
        
        {/* Header toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-white tracking-wide">
              AWS Cloud Architecture Active
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
              ap-southeast-2
            </span>
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* Expanded Details */}
        {expanded && (
          <div className="p-4 pt-1 border-t border-white/5 space-y-2 text-xs">
            <p className="text-[11px] text-slate-400 mb-2">
              Every action in this UI directly invokes your live serverless cloud infrastructure on AWS:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {services.map((s, idx) => (
                <div key={idx} className="p-2 rounded-xl bg-slate-900/60 border border-white/5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-indigo-300">{s.name}</span>
                    <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      {s.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">{s.role}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-slate-500 text-center">
              100% AWS Free Tier Compliant • Scales to zero when idle
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
