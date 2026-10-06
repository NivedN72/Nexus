import React, { useState } from 'react';
import { Tag, MapPin, Sparkles, CheckCircle2, Clock, Image as ImageIcon } from 'lucide-react';
import { DEFAULT_CONFIG } from '../config';

export default function ItemCard({ item }) {
  const [failedImageUrl, setFailedImageUrl] = useState(null);
  const isLost = item.type === 'lost';
  const isMatched = item.status === 'matched';
  const tags = Array.isArray(item.tags)
    ? item.tags.map((t) => (typeof t === 'object' && t.S ? t.S : t))
    : [];

  const getImageUrl = (key) => {
    if (!key) return null;
    if (key.startsWith('http')) return key;
    return `https://${DEFAULT_CONFIG.s3BucketName}.s3.${DEFAULT_CONFIG.cognito.region}.amazonaws.com/${key}`;
  };

  const imageUrl = getImageUrl(item.imageUrl);
  const canShowImage = imageUrl && failedImageUrl !== imageUrl;

  return (
    <div
      className={`glass-card rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 ${
        isMatched
          ? 'border-purple-500/50 glow-purple bg-purple-950/20'
          : 'glass-card-hover border-white/10'
      }`}
    >
      <div>
        {/* Photo Header */}
        <div className="relative w-full h-44 bg-slate-900 overflow-hidden flex items-center justify-center">
          {canShowImage ? (
            <img
              src={imageUrl}
              alt={item.title}
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              onError={() => setFailedImageUrl(imageUrl)}
            />
          ) : null}

          {/* Placeholder if image not loaded */}
          <div
            className={`w-full h-full flex flex-col items-center justify-center text-slate-500 ${
              canShowImage ? 'hidden' : 'flex'
            }`}
          >
            <ImageIcon className="w-8 h-8 mb-1 text-slate-600" />
            <span className="text-xs">{imageUrl ? 'Photo unavailable. Refresh to retry.' : 'No photo uploaded'}</span>
          </div>

          {/* Top Badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border shadow-md backdrop-blur-md ${
                isLost
                  ? 'bg-amber-500/25 text-amber-200 border-amber-500/40'
                  : 'bg-emerald-500/25 text-emerald-200 border-emerald-500/40'
              }`}
            >
              {item.type}
            </span>
          </div>

          <div className="absolute top-3 right-3">
            {isMatched ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-600/90 text-white border border-purple-400 shadow-lg shadow-purple-600/50 flex items-center gap-1.5 animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
                AI MATCHED
              </span>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-900/80 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 backdrop-blur-md">
                <Clock className="w-3 h-3" />
                Open
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5">
          <h3 className="text-lg font-bold text-white mb-1.5 line-clamp-1">
            {item.title}
          </h3>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="line-clamp-1">{item.location}</span>
          </div>

          <p className="text-sm text-slate-300 line-clamp-2 mb-4 leading-relaxed">
            {item.description || 'No description provided.'}
          </p>

          {/* AI Rekognition Tags */}
          <div className="mb-4">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>AWS Rekognition Vision Tags:</span>
            </div>

            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 flex items-center gap-1"
                  >
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-500 italic flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                Waiting for image upload to tag...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-5 py-3 bg-slate-950/60 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
        <span className="truncate max-w-[180px]">By: {item.reportedBy || item.userEmail}</span>
        {isMatched && (
          <span className="text-purple-300 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-purple-400" />
            Matched!
          </span>
        )}
      </div>
    </div>
  );
}
