import React, { useState } from 'react';
import { MapPin, Sparkles, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { DEFAULT_CONFIG } from '../config';

export default function ItemCard({ item }) {
  const [failedImageUrl, setFailedImageUrl] = useState(null);
  const isMatched = item.status === 'matched';
  const tags = Array.isArray(item.tags) ? item.tags.map(t => typeof t === 'object' && t.S ? t.S : t) : [];
  const getImageUrl = key => {
    if (!key) return null;
    if (key.startsWith('http')) return key;
    return `https://${DEFAULT_CONFIG.s3BucketName}.s3.${DEFAULT_CONFIG.cognito.region}.amazonaws.com/${key}`;
  };
  const imageUrl = getImageUrl(item.imageUrl);
  const canShowImage = imageUrl && failedImageUrl !== imageUrl;

  return <article className={`nexus-item-report ${isMatched ? 'is-matched' : ''}`}>
    <div className="nexus-item-photo">
      {canShowImage ? <img src={imageUrl} alt={item.title} loading="lazy" onError={()=>setFailedImageUrl(imageUrl)}/> :
        <div className="nexus-item-placeholder"><ImageIcon size={32} strokeWidth={1}/><span>{imageUrl ? 'Photo unavailable. Refresh to retry.' : 'No photo uploaded'}</span></div>}
      <span className={`nexus-item-type ${item.type === 'lost' ? 'is-lost' : ''}`}>{item.type}</span>
    </div>
    <div className="nexus-item-body">
      <div className="nexus-item-location"><MapPin size={13} aria-hidden="true"/><span>{item.location}</span><span className="nexus-item-state">{isMatched ? <><CheckCircle2 size={12}/>Matched</> : 'Open'}</span></div>
      <h3>{item.title}</h3><p>{item.description || 'No description provided.'}</p>
      <div className="nexus-item-tags"><span><Sparkles size={13}/>AWS Rekognition Vision Tags</span>{tags.length ? <div>{tags.map((tag,i)=><span key={i}>{tag}</span>)}</div> : <p>Waiting for image upload to tag...</p>}</div>
      <footer><span>By: {item.reportedBy || item.userEmail}</span>{isMatched && <Sparkles size={15} aria-label="AI matched"/>}</footer>
    </div>
  </article>;
}
