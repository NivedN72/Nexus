import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import useNexusMotion from './hooks/useNexusMotion';
import useInteractionMotion from './hooks/useInteractionMotion';
import HomePage from './components/HomePage';
import PageHeader from './components/PageHeader';
import EventCard from './components/EventCard';
import { sortEventsByDate } from './utils/events';
import BookingPass from './components/BookingPass';
import ItemCard from './components/ItemCard';
import ReportItemModal from './components/ReportItemModal';
import CreateEventModal from './components/CreateEventModal';
import AuthModal from './components/AuthModal';
import BookEventModal from './components/BookEventModal';
import AwsArchitectureBadge from './components/AwsArchitectureBadge';
import { api } from './services/api';
import { cognitoService } from './services/cognito';
import { 
  Sparkles, Calendar, PlusCircle, Search, RefreshCw, Ticket, 
  AlertCircle, CheckCircle2, Shield, Info, ArrowRight, LogIn 
} from 'lucide-react';

export default function App() {
  const motionRoot = useRef(null);
  useNexusMotion(motionRoot);
  useInteractionMotion(motionRoot);
  const [theme, setTheme] = useState(() => {
    if (document.documentElement.dataset.theme) return document.documentElement.dataset.theme;
    try {
      const stored = localStorage.getItem('nexus_theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch { /* Theme still works when browser storage is unavailable. */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('nexus_theme', theme); } catch { /* Keep the current session preference. */ }
  }, [theme]);
  const [activeTab, setActiveTab] = useState('home');
  const [currentUser, setCurrentUser] = useState(() => cognitoService.restoreSession());
  
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [activeTab]);

  // Data State
  const [events, setEvents] = useState([]);
  const [items, setItems] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [itemFilter, setItemFilter] = useState('all'); // all, lost, found, matched
  
  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const bookingLoadingId = null;
  const [toast, setToast] = useState(null);

  // Modals
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const dataRequest = useRef(0);
  const bookingRequest = useRef(0);
  const bookingsLoaded = useRef(false);
  const bookingsPending = useRef(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const isSignedIn = Boolean(currentUser?.token);
  const isStudent = isSignedIn && currentUser.isStudent;
  const isAdmin = isSignedIn && currentUser.role === 'admin';

  const changeUser = (user) => {
    if (user) cognitoService.saveSession(user);
    else cognitoService.clearSession();
    dataRequest.current += 1;
    bookingRequest.current += 1;
    bookingsLoaded.current = false;
    bookingsPending.current = false;
    setLoadingBookings(false);
    setItems([]);
    setBookings([]);
    setIsReportOpen(false);
    setIsCreateEventOpen(false);
    setCurrentUser(user);
    if (!user) { setActiveTab('home'); setSelectedEventForBooking(null); }
    else if (selectedEventForBooking) setActiveTab('events');
  };

  const openReport = () => {
    if (isStudent) setIsReportOpen(true);
    else if (isSignedIn) { setActiveTab('lostfound'); showToast('Lost & Found requires approved student access.', 'error'); }
    else setIsAuthOpen(true);
  };

  const loadData = async () => {
    const request = ++dataRequest.current;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        api.getEvents(),
        ...(isStudent ? [api.getItems(currentUser)] : []),
      ]);
      if (request !== dataRequest.current) return;
      if (results[0].status === 'fulfilled') setEvents(results[0].value.events || []);
      else showToast('Could not load campus events.', 'error');
      if (results[1]?.status === 'fulfilled') setItems(results[1].value.items || []);
      else if (results[1]?.status === 'rejected') showToast('Could not load lost and found items.', 'error');
    } finally {
      if (request === dataRequest.current) setLoading(false);
    }
  };

  const loadBookings = async () => {
    if (!isSignedIn || bookingsPending.current) return;
    const request = ++bookingRequest.current;
    bookingsPending.current = true;
    setLoadingBookings(true);
    try {
      const data = await api.getMyBookings(currentUser);
      if (request === bookingRequest.current) {
        setBookings(data.bookings || []);
        bookingsLoaded.current = true;
      }
    } catch (err) {
      if (request === bookingRequest.current) showToast(err.message, 'error');
    } finally {
      if (request === bookingRequest.current) {
        bookingsPending.current = false;
        setLoadingBookings(false);
      }
    }
  };

  useEffect(() => {
    loadData();
    return () => { dataRequest.current += 1; };
  }, [currentUser]);

  // Preserve the cache across tabs, but never across sign-in sessions.
  useEffect(() => () => {
    bookingRequest.current += 1;
    bookingsLoaded.current = false;
    bookingsPending.current = false;
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'bookings' && isSignedIn && !bookingsLoaded.current) loadBookings();
  }, [activeTab, currentUser]);

  const [selectedEventForBooking, setSelectedEventForBooking] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    const expireSession = () => {
      if (!Number.isFinite(currentUser.expiresAt) || Date.now() >= currentUser.expiresAt) {
        changeUser(null);
        showToast('Your session has expired. Please sign in again.', 'error');
      }
    };
    const timer = setTimeout(expireSession, Math.max(0, currentUser.expiresAt - Date.now()));
    // Recheck when returning to a tab whose timers may have been suspended.
    window.addEventListener('focus', expireSession);
    document.addEventListener('visibilitychange', expireSession);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', expireSession);
      document.removeEventListener('visibilitychange', expireSession);
    };
  }, [currentUser]);

  const handleBookEvent = (event) => {
    if (isAdmin) return;
    setSelectedEventForBooking(event);
    if (!isSignedIn) setIsAuthOpen(true);
  };

  const filteredItems = items.filter((item) => {
    if (itemFilter === 'lost') return item.type === 'lost';
    if (itemFilter === 'found') return item.type === 'found';
    if (itemFilter === 'matched') return item.status === 'matched';
    return true;
  });

  return (
    <div ref={motionRoot} className="min-h-[100dvh] flex flex-col bg-canvas text-ink">
      
      {/* Navbar */}
      <Navbar
        theme={theme}
        onToggleTheme={() => setTheme(previous => previous === 'dark' ? 'light' : 'dark')}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        setCurrentUser={changeUser}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Toast Alert */}
      {toast && (
        <div data-motion="notice" className="fixed top-20 right-4 z-50 max-w-[calc(100vw-32px)]">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-sm text-xs font-semibold backdrop-blur-xl border ${
              toast.type === 'error'
                ? 'bg-danger/20 text-danger border-danger/25 '
                : 'bg-success/20 text-success border-success/25'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-danger shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 nexus-main max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24${activeTab === 'home' ? ' nexus-main--home' : ''}`}>
        
        {activeTab === 'home' && <HomePage currentUser={currentUser} navigate={setActiveTab} onReport={openReport} />}

        {activeTab === 'events' && <section className="nexus-service-page">
          <PageHeader Icon={Calendar} eyebrow="OPEN TO EVERYONE" title="Campus Events" description="Publicly visible • Live seat counter with DynamoDB race-condition protection">
            {isAdmin && <button onClick={() => setIsCreateEventOpen(true)} className="nexus-button-primary"><PlusCircle size={18}/>Create Event (Admin)</button>}
            <button onClick={loadData} title="Refresh from DynamoDB" aria-label="Refresh events" className="nexus-button-secondary"><RefreshCw size={16} className={loading?'animate-spin':''}/>Refresh</button>
          </PageHeader>
          <div className="nexus-section-strip"><h2>All Events</h2><span>{loading && !events.length ? 'Loading…' : events.length + (events.length===1?' event':' events')}</span></div>
          {loading && !events.length ? <div className="nexus-event-board">{[1,2,3].map(n=><div key={n} className="nexus-skeleton animate-pulse" />)}</div> : !events.length ?
            <div className="nexus-empty-state"><Calendar size={44}/><h3>No campus events found</h3><p>Check back soon for upcoming campus events.</p>{isAdmin && <button className="nexus-button-primary" onClick={()=>setIsCreateEventOpen(true)}>Create Event</button>}</div> :
            <div className="nexus-event-board">{sortEventsByDate(events).map(event=><EventCard key={event.eventId} event={event} onBook={handleBookEvent} canBook={!isAdmin} bookingLoading={bookingLoadingId===event.eventId} />)}</div>}
        </section>}

        {activeTab === 'lostfound' && <section className="nexus-service-page">
          <PageHeader Icon={Search} eyebrow="STUDENT COMMUNITY" title="Lost & Found" description="Photos analyzed by AWS Rekognition & auto-matched via DynamoDB Streams">
            {isStudent && <><button onClick={openReport} className="nexus-button-primary"><PlusCircle size={18}/>Report Lost / Found</button><button onClick={loadData} aria-label="Refresh items" className="nexus-button-secondary"><RefreshCw size={16} className={loading?'animate-spin':''}/>Refresh</button></>}
          </PageHeader>
          {!isSignedIn ? <AccessPanel Icon={Search} title="Sign in to Lost & Found" description="Lost & Found requires approved student access." onSignIn={()=>setIsAuthOpen(true)} /> : !isStudent ?
            <AccessPanel Icon={Shield} title="Lost & Found is for verified students" description="Ask a campus admin to verify your student status. You can still book events and view your tickets." onBrowse={()=>setActiveTab('events')} /> :
            <div className="nexus-gallery-layout">
              <aside className="nexus-gallery-sidebar"><h2>AI Matching Gallery</h2><p>Lost, found, or reunited.</p><nav aria-label="Filter items">{['all','lost','found','matched'].map(tab=><button key={tab} onClick={()=>setItemFilter(tab)} aria-pressed={itemFilter===tab} className={itemFilter===tab?'is-active':''}><span>{tab==='all'?'All items':tab}</span><ArrowRight size={15}/></button>)}</nav><div className="nexus-gallery-note"><Sparkles size={23}/><p>AWS Rekognition Vision Tags help identify possible matches.</p></div></aside>
              <div className="nexus-gallery-content"><div className="nexus-section-strip"><h2>{itemFilter==='all'?'Lost & Found AI Matching Gallery':itemFilter.charAt(0).toUpperCase()+itemFilter.slice(1)+' items'}</h2><span>{filteredItems.length} items</span></div>
                {loading && !items.length ? <div className="nexus-items-grid">{[1,2,3].map(n=><div key={n} className="nexus-skeleton animate-pulse"/>)}</div> : !filteredItems.length ? <div className="nexus-empty-state"><Search size={44}/><h3>No items found</h3><p>Be the first to report a lost or found item with a photo.</p><button onClick={openReport} className="nexus-button-primary">Report Item</button></div> : <div className="nexus-items-grid">{filteredItems.map(item=><ItemCard key={item.itemId} item={item}/>)}</div>}
              </div>
            </div>}
        </section>}

        {activeTab === 'bookings' && <section className="nexus-service-page">
          <PageHeader Icon={Ticket} eyebrow="YOUR CAMPUS PASSES" title="My Bookings" description={isSignedIn?'Confirmed Tickets for '+currentUser.name:'Sign in with your visitor or student account to view your tickets.'}>
            {isSignedIn && <button className="nexus-button-secondary" onClick={loadBookings} disabled={loadingBookings}><RefreshCw size={16} className={loadingBookings ? 'animate-spin' : ''}/>{loadingBookings ? 'Loading tickets...' : 'Refresh tickets'}</button>}
            <button className="nexus-button-primary" onClick={()=>setActiveTab('events')}>Browse Campus Events<ArrowRight size={18}/></button>
          </PageHeader>
          {!isSignedIn ? <AccessPanel Icon={Ticket} title="Sign in to My Bookings" description="Your reservations are linked to your signed-in account." onSignIn={()=>setIsAuthOpen(true)}/> :
            <div className="nexus-bookings-layout"><aside className="nexus-bookings-summary"><Ticket size={32}/><h2>Your next<br/>campus moment.</h2><p>{currentUser.name}</p><span>{currentUser.email}</span><div className="nexus-booking-total"><strong>{bookings.length}</strong><span>Confirmed tickets</span></div></aside><div className="nexus-ticket-list"><p className="nexus-data-note">Queried via DynamoDB Global Secondary Index (userId-index)</p>
              {loadingBookings && !bookings.length ? <div className="nexus-empty-state" role="status"><RefreshCw size={32} className="animate-spin"/><p>Loading your tickets...</p></div> : !bookings.length ? <div className="nexus-empty-state"><Ticket size={44}/><h3>No bookings yet</h3><p>You have not booked any event seats as {currentUser.email}.</p><button className="nexus-button-primary" onClick={()=>setActiveTab('events')}>Browse Campus Events</button></div> : sortEventsByDate(bookings, booking => events.find(event => event.eventId === booking.eventId)).map(b=><BookingPass key={b.bookingId} booking={b} event={events.find(event => event.eventId === b.eventId)} loadingEvent={loading}/>)}
            </div></div>}
        </section>}
        <footer className="nexus-footer"><button onClick={()=>setActiveTab('home')}><Sparkles size={17}/>Nexus</button><span>Events & AI Lost and Found</span><span>AWS Serverless</span></footer>
      </main>

      {/* Floating AWS Architecture Badge */}
      <AwsArchitectureBadge />

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => { setIsAuthOpen(false); if (!isSignedIn) setSelectedEventForBooking(null); }}
        onAuthSuccess={(user) => {
          changeUser(user);
          setIsAuthOpen(false);
          showToast(`Welcome back, ${user.name}! Authenticated with Cognito.`, 'success');
        }}
      />

      <ReportItemModal
        isOpen={isReportOpen && isStudent}
        onClose={() => setIsReportOpen(false)}
        currentUser={currentUser}
        onItemReported={() => {
          loadData();
          showToast('Photo uploaded to S3! Rekognition is analyzing tags...', 'success');
        }}
      />

      <CreateEventModal
        isOpen={isCreateEventOpen && isAdmin}
        onClose={() => setIsCreateEventOpen(false)}
        currentUser={currentUser}
        onEventCreated={() => {
          loadData();
          showToast('Event published to DynamoDB!', 'success');
        }}
      />

      {isSignedIn && !isAdmin && selectedEventForBooking && (
        <BookEventModal
          key={`${currentUser.id}:${selectedEventForBooking.eventId}`}
          isOpen={true}
          onClose={() => setSelectedEventForBooking(null)}
          event={selectedEventForBooking}
          currentUser={currentUser}
          onBookingSuccess={(res) => {
            loadData();
            // A new reservation changes the cached list; fetch it on the next visit.
            bookingRequest.current += 1;
            bookingsPending.current = false;
            bookingsLoaded.current = false;
            setLoadingBookings(false);
            if (activeTab === 'bookings') loadBookings();
            showToast(`Reservation confirmed! Remaining seats: ${res.remainingSeats}`, 'success');
          }}
        />
      )}

    </div>
  );
}

function AccessPanel({ Icon, title, description, onSignIn, onBrowse }) {
  return <div className="nexus-access-panel"><div className="nexus-access-art"><Icon size={64} strokeWidth={1.25}/><span>Your campus. Connected.</span></div><div className="nexus-access-copy"><span className="nexus-eyebrow">ACCOUNT ACCESS</span><h2>{title}</h2><p>{description}</p>{onSignIn && <button className="nexus-button-primary" onClick={onSignIn}><LogIn size={17}/>Sign In</button>}{onBrowse && <button className="nexus-button-primary" onClick={onBrowse}>Browse Campus Events<ArrowRight size={17}/></button>}</div></div>;
}
