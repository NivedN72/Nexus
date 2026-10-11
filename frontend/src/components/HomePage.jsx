import React from 'react';
import { ArrowUpRight, Calendar, Search, Ticket, Sparkles } from 'lucide-react';

const services = [
  { page: 'events', title: 'Campus Events', access: 'Open to everyone', icon: Calendar,
    description: 'Find your next event. Visitors and students can sign in to reserve a seat.' },
  { page: 'lostfound', title: 'Lost & Found', access: 'Students only', icon: Search,
    description: 'Report a lost or found item with a photo and check possible matches.' },
  { page: 'bookings', title: 'My Bookings', access: 'Your signed-in account', icon: Ticket,
    description: 'Keep your confirmed campus tickets together in one place.' },
];

export default function HomePage({ navigate, currentUser, onReport }) {
  const signedIn = Boolean(currentUser?.token);
  const student = Boolean(currentUser?.isStudent);
  const admin = currentUser?.role === 'admin';
  const firstName = currentUser?.name?.trim().split(/\s+/)[0];
  const titleLines = ['Your campus.', 'All in one place.'];
  const title = titleLines.join(' ');
  const secondaryLabel = signedIn && !student ? 'My bookings' : 'Report a lost item';
  const secondaryAction = signedIn && !student ? () => navigate('bookings') : onReport;

  return <div className="nexus-home">
    <section className="nexus-home-hero nexus-home-hero--panorama" aria-labelledby="nexus-home-title">
      <div className="nexus-home-copy">
        <div className="nexus-eyebrow"><Sparkles size={16} aria-hidden="true"/>{signedIn ? `Welcome back${firstName ? ', ' + firstName : ''}` : 'Events, tickets, and Lost & Found'}</div>
        <h1 id="nexus-home-title" aria-label={title}>{titleLines.map((line, lineIndex) => <span className="nexus-hero-title-line" key={lineIndex} aria-hidden="true">{line.split(' ').map((word, index, words) => <React.Fragment key={index}><span className="nexus-word-mask"><span className="nexus-title-word">{word}</span></span>{index < words.length - 1 ? ' ' : null}</React.Fragment>)}</span>)}</h1>
        <p className="nexus-home-intro">Find an event, reserve your seat, and keep your tickets together. Lost something? Students can report it with a photo and check possible matches.</p>
        <div className="nexus-hero-actions">
          <button type="button" className="nexus-hero-primary" onClick={() => navigate('events')}>{admin ? 'Manage events' : 'Browse events'}<ArrowUpRight size={19} aria-hidden="true"/></button>
          <button type="button" className="nexus-hero-secondary" onClick={secondaryAction}>{signedIn && !student ? <Ticket size={17} aria-hidden="true"/> : <Search size={17} aria-hidden="true"/>}{secondaryLabel}</button>
        </div>

      </div>
      <div className="nexus-campus-composition"><div className="nexus-campus-plane">
        <picture><source srcSet="/images/nexus-campus.webp" type="image/webp"/><img className="nexus-campus-photo" src="/images/nexus-campus.png" alt="Students walking together through a tree-lined campus courtyard" width="1122" height="1402" fetchpriority="high"/></picture>
      </div></div>
    </section>
    <nav className="nexus-home-tabs" aria-label="Explore Nexus services">
      {services.map(({ page, title, access, icon: Icon, description }) =>
        <button key={page} type="button" className="nexus-home-tab" onClick={() => navigate(page)}>
          <span className="nexus-home-tab-top"><Icon size={20} aria-hidden="true"/><span>{access}</span><ArrowUpRight className="nexus-home-tab-arrow" size={22} aria-hidden="true"/></span>
          <strong>{title}</strong><span className="nexus-home-tab-description">{description}</span>
        </button>
      )}
    </nav>
    <aside className="nexus-home-cloud-note"><span>How it's built</span><p>Amazon Cognito handles sign-in. AWS Lambda and DynamoDB handle bookings. Private S3 uploads and Rekognition help students compare item reports.</p></aside>
  </div>;
}
