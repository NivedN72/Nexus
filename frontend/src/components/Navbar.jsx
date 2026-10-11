import React, { useRef } from 'react';
import useNavigationMotion from '../hooks/useNavigationMotion';
import { Home, Calendar, Search, Ticket, Settings, Sparkles, LogIn, LogOut } from 'lucide-react';
const links = [{id:'home',label:'Home',short:'Home',Icon:Home},{id:'events',label:'Campus Events',short:'Events',Icon:Calendar},{id:'lostfound',label:'Lost & Found',short:'Lost & Found',Icon:Search},{id:'bookings',label:'My Bookings',short:'Bookings',Icon:Ticket}];
export default function Navbar({ activeTab, setActiveTab, currentUser, setCurrentUser, onOpenSettings, onOpenAuth }) {
  const navRef = useRef(null);
  useNavigationMotion(navRef, activeTab);
  return <header className="nexus-header sticky top-0 z-40">
    <div className="nexus-nav-bar">
      <button className="nexus-brand" onClick={() => setActiveTab('home')} aria-label="Nexus Home"><span className="nexus-brand-mark"><Sparkles size={22} /></span><span>Nexus<small>Events &amp; AI Lost and Found</small></span></button>
      <nav ref={navRef} className="nexus-nav-links" aria-label="Main navigation">{links.map(({id,label}) => <button key={id} onClick={() => setActiveTab(id)} aria-current={activeTab===id?'page':undefined} className={activeTab===id?'is-active':''}>{label}</button>)}<span className="nexus-nav-indicator" aria-hidden="true"/></nav>
      <div className="nexus-nav-account">{currentUser?.token ? <div className="nexus-account"><span><strong>{currentUser.name}</strong><small>{currentUser.role}</small></span><button title="Sign Out" aria-label="Sign Out" onClick={() => setCurrentUser(null)}><LogOut size={16} /></button></div> : <button onClick={onOpenAuth} className="nexus-sign-in"><LogIn size={16} /><span>Sign In</span></button>}<button className="nexus-nav-settings" title="Configure AWS Endpoints" aria-label="Configure AWS Endpoints" onClick={onOpenSettings}><Settings size={18} /></button></div>
    </div>
    <nav className="nexus-mobile-nav" aria-label="Mobile navigation">{links.map(({id,short,Icon}) => <button key={id} onClick={() => setActiveTab(id)} aria-current={activeTab===id?'page':undefined} className={activeTab===id?'is-active':''}><Icon size={16}/><span>{short}</span></button>)}</nav>
  </header>;
}
