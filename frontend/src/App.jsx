import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import EventCard from './components/EventCard';
import ItemCard from './components/ItemCard';
import ReportItemModal from './components/ReportItemModal';
import CreateEventModal from './components/CreateEventModal';
import SettingsModal from './components/SettingsModal';
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
  const [activeTab, setActiveTab] = useState('events');
  const [currentUser, setCurrentUser] = useState(() => cognitoService.restoreSession());
  
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const dataRequest = useRef(0);
  const bookingRequest = useRef(0);
  const isSignedIn = Boolean(currentUser?.token);
  const isStudent = isSignedIn && currentUser.isStudent;
  const isAdmin = isSignedIn && currentUser.role === 'admin';

  const changeUser = (user) => {
    if (user) cognitoService.saveSession(user);
    else cognitoService.clearSession();
    dataRequest.current += 1;
    bookingRequest.current += 1;
    setItems([]);
    setBookings([]);
    setIsReportOpen(false);
    setIsCreateEventOpen(false);
    setCurrentUser(user);
    if (!user) { setActiveTab('events'); setSelectedEventForBooking(null); }
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
    if (!isSignedIn) return;
    const request = ++bookingRequest.current;
    setBookings([]);
    try {
      const data = await api.getMyBookings(currentUser);
      if (request === bookingRequest.current) setBookings(data.bookings || []);
    } catch (err) {
      if (request === bookingRequest.current) showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    loadData();
    return () => { dataRequest.current += 1; };
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'bookings' && isSignedIn) loadBookings();
    return () => { bookingRequest.current += 1; };
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
    <div className="min-h-screen flex flex-col bg-[#0b0f19] text-slate-100">
      
      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        setCurrentUser={changeUser}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 animate-bounce">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold backdrop-blur-xl border ${
              toast.type === 'error'
                ? 'bg-rose-500/20 text-rose-200 border-rose-500/40 glow-cyan'
                : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Hero Banner */}
        <div className="relative glass-card rounded-3xl p-6 sm:p-8 mb-8 border border-white/10 overflow-hidden shadow-2xl">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-indigo-300 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Serverless Cloud Architecture on AWS Free Tier
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
                Campus Events & AI-Assisted Lost & Found
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                Atomic conditional seat bookings with DynamoDB & automatic computer vision item matching using AWS Rekognition and DynamoDB Streams.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={openReport}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/25 flex items-center gap-2 transition-all active:scale-[0.98]"
              >
                <Search className="w-4 h-4" />
                Report Lost / Found
              </button>

              {isAdmin && (
                <button
                  onClick={() => setIsCreateEventOpen(true)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all active:scale-[0.98]"
                >
                  <PlusCircle className="w-4 h-4" />
                  Create Event (Admin)
                </button>
              )}

              <button
                onClick={loadData}
                title="Refresh from DynamoDB"
                className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-white/10 border border-white/5 text-slate-300 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: CAMPUS EVENTS */}
        {activeTab === 'events' && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-indigo-400" />
                  Upcoming Events
                </h2>
                <p className="text-xs text-slate-400">Publicly visible &bull; Live seat counter with DynamoDB race-condition protection</p>
              </div>

              {isAdmin && (
                <button
                  onClick={() => setIsCreateEventOpen(true)}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-all"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add Event
                </button>
              )}
            </div>

            {loading && events.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="glass-card rounded-2xl p-6 h-72 animate-pulse bg-slate-900/40"></div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center text-slate-400 border border-white/5">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <h3 className="text-lg font-bold text-white mb-1">No campus events found</h3>
                <p className="text-xs max-w-sm mx-auto mb-4">Check back soon for upcoming campus events.</p>
                {isAdmin && (
                  <button onClick={() => setIsCreateEventOpen(true)} className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white">
                    Create Event
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => (
                  <EventCard
                    key={event.eventId}
                    event={event}
                    onBook={handleBookEvent}
                    canBook={!isAdmin}
                    bookingLoading={bookingLoadingId === event.eventId}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {!isSignedIn && activeTab !== 'events' && (
          <section className="glass-card rounded-2xl p-12 text-center border border-white/5">
            <LogIn className="w-10 h-10 mx-auto mb-3 text-indigo-400" />
            <h2 className="text-xl font-bold mb-2">Sign in to {activeTab === 'lostfound' ? 'Lost & Found' : 'My Bookings'}</h2>
            <p className="text-sm text-slate-400 mb-4">Sign in with your visitor or student account to view your tickets. Lost & Found requires approved student access.</p>
            <button onClick={() => setIsAuthOpen(true)} className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold">Sign In</button>
          </section>
        )}

        {activeTab === 'lostfound' && isSignedIn && !isStudent && (
          <section className="glass-card rounded-2xl p-12 text-center border border-white/5">
            <Shield className="w-10 h-10 mx-auto mb-3 text-indigo-400" />
            <h2 className="text-xl font-bold mb-2">Lost & Found is for verified students</h2>
            <p className="text-sm text-slate-400">Ask a campus admin to verify your student status. You can still book events and view your tickets.</p>
          </section>
        )}

        {/* TAB 2: LOST & FOUND */}
        {activeTab === 'lostfound' && isStudent && (
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Search className="w-6 h-6 text-purple-400" />
                  Lost & Found AI Matching Gallery
                </h2>
                <p className="text-xs text-slate-400">Photos analyzed by AWS Rekognition & auto-matched via DynamoDB Streams</p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-white/5 self-start text-xs font-medium">
                {['all', 'lost', 'found', 'matched'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setItemFilter(tab)}
                    className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                      itemFilter === tab
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {loading && items.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="glass-card rounded-2xl h-80 animate-pulse bg-slate-900/40"></div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center text-slate-400 border border-white/5">
                <Search className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <h3 className="text-lg font-bold text-white mb-1">No items found</h3>
                <p className="text-xs max-w-sm mx-auto mb-4">Be the first to report a lost or found item with a photo.</p>
                <button
                  onClick={openReport}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 text-white"
                >
                  Report Item
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredItems.map((item) => (
                  <ItemCard key={item.itemId} item={item} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: MY BOOKINGS */}
        {activeTab === 'bookings' && isSignedIn && (
          <section className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Ticket className="w-6 h-6 text-cyan-400" />
                Confirmed Tickets for {currentUser.name}
              </h2>
              <p className="text-xs text-slate-400">Queried via DynamoDB Global Secondary Index (userId-index)</p>
            </div>

            {bookings.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center text-slate-400 border border-white/5">
                <Ticket className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <h3 className="text-lg font-bold text-white mb-1">No bookings yet</h3>
                <p className="text-xs mb-4">You have not booked any event seats as {currentUser.email}.</p>
                <button
                  onClick={() => setActiveTab('events')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white"
                >
                  Browse Campus Events
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((b) => (
                  <div
                    key={b.bookingId}
                    className="glass-card glass-card-hover rounded-2xl p-5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {b.status || 'CONFIRMED'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          ID: {b.bookingId.slice(0, 8)}...
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-white">{b.eventTitle || 'Campus Event'}</h4>
                      <p className="text-xs text-slate-400">Booked on: {new Date(b.bookingTime).toLocaleString()}</p>
                    </div>

                    <div className="text-right">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Valid Campus Pass
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
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
            if (activeTab === 'bookings') loadBookings();
            showToast(`Reservation confirmed! Remaining seats: ${res.remainingSeats}`, 'success');
          }}
        />
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
