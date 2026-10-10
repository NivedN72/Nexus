import React from 'react';
import { ArrowUpRight, Calendar, Search, Ticket, Sparkles } from 'lucide-react';

const services = [
  { page: 'events', title: 'Campus Events', access: 'Open to everyone', icon: Calendar,
    description: 'Browse upcoming campus events. Sign in with your visitor or student account to reserve a seat.' },
  { page: 'lostfound', title: 'Lost & Found', access: 'Students only', icon: Search,
    description: 'Report an item with a photo. AWS Rekognition helps identify possible matches.' },
  { page: 'bookings', title: 'My Bookings', access: 'Your signed-in account', icon: Ticket,
    description: 'All your confirmed campus tickets, linked to your signed-in account.' },
];

export default function HomePage({ navigate }) {
  return <div className="nexus-home">
    <section className="nexus-home-hero" aria-labelledby="nexus-home-title">
      <div className="nexus-home-copy">
        <div className="nexus-eyebrow"><Sparkles size={15} />Serverless Cloud Architecture on AWS Free Tier</div>
        <h1 id="nexus-home-title">Campus Events &amp; AI-Assisted Lost &amp; Found</h1>
        <p className="nexus-home-intro">Atomic conditional seat bookings with DynamoDB &amp; automatic computer vision item matching using AWS Rekognition and DynamoDB Streams.</p>
      </div>
      <div className="nexus-campus-composition">
        <img className="nexus-campus-photo" src="/images/nexus-campus.png" alt="Illustrative campus scene with students walking through a courtyard" width="1122" height="1402" fetchpriority="high" />
        <div className="nexus-hero-pass" aria-hidden="true"><span className="nexus-hero-pass-mark"><Ticket size={24}/></span><div><small>Campus pass</small><strong>Your next campus moment.</strong></div><span className="nexus-hero-pass-tear" /></div>
        <div className="nexus-hero-item" aria-hidden="true"><Search size={18}/><span><small>Photo reports</small><strong>Lost &amp; Found</strong></span><Sparkles size={16}/></div>
      </div>
    </section>
    <nav className="nexus-home-tabs" aria-label="Explore Nexus services">
      {services.map(({ page, title, access, icon: Icon, description }) =>
        <button key={page} type="button" className="nexus-home-tab" onClick={() => navigate(page)}>
          <span className="nexus-home-tab-top"><Icon size={20} aria-hidden="true"/><span>{access}</span><ArrowUpRight className="nexus-home-tab-arrow" size={22} aria-hidden="true"/></span>
          <strong>{title}</strong><span className="nexus-home-tab-description">{description}</span>
        </button>
      )}
    </nav>
  </div>;
}
