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
    <div className="nexus-cloud-badge">
      <div className="glass-card rounded-2xl border border-line shadow-sm overflow-hidden backdrop-blur-xl">
        
        {/* Header toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-surface transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className=" absolute inline-flex h-full w-full rounded-full bg-success/10 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success/10"></span>
            </span>
            <span className="text-xs font-bold text-ink tracking-wide">
              AWS Cloud Architecture Active
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent-ink font-mono">
              ap-southeast-2
            </span>
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted" />
          )}
        </button>

        {/* Expanded Details */}
        {expanded && (
          <div data-motion="cloud-details" className="p-4 pt-1 border-t border-line space-y-2 text-xs">
            <p className="text-[11px] text-muted mb-2">
              Every action in this UI directly invokes your live serverless cloud infrastructure on AWS:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {services.map((s, idx) => (
                <div key={idx} className="p-2 rounded-xl bg-soft border border-line">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-accent-ink">{s.name}</span>
                    <span className="text-[9px] px-1 rounded bg-success/20 text-success font-semibold">
                      {s.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted">{s.role}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-line text-[10px] text-muted text-center">
              100% AWS Free Tier Compliant • Scales to zero when idle
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
