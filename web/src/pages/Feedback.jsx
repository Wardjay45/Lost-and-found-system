import { useState, useEffect } from 'react';

/* ── Dummy seed data (replace with real API when mobile is ready) ── */
const SEED_FEEDBACK = [
  { id: 1, user: 'Maria Santos',    avatar: 'MS', item: 'Black Wallet',        category: 'Wallet',     rating: 5, speed: 'Same day',  comment: 'Super fast! Got my wallet back within hours. Amazing service!', date: '2026-09-08', status: 'claimed' },
  { id: 2, user: 'John Rivera',     avatar: 'JR', item: 'Samsung Galaxy S24',  category: 'Electronics',rating: 4, speed: '1–3 days', comment: 'Great system, very organized process.', date: '2026-09-07', status: 'claimed' },
  { id: 3, user: 'Ana Reyes',       avatar: 'AR', item: 'Blue Backpack',        category: 'Bag',        rating: 5, speed: 'Same day',  comment: 'Incredible! Thank you so much to the team.', date: '2026-09-06', status: 'claimed' },
  { id: 4, user: 'Carlo Mendoza',   avatar: 'CM', item: 'Student ID',           category: 'ID / Card',  rating: 3, speed: '4–7 days', comment: 'Process was okay but took a bit longer than expected.', date: '2026-09-05', status: 'claimed' },
  { id: 5, user: 'Lea Gonzales',    avatar: 'LG', item: 'AirPods Pro',          category: 'Electronics',rating: 5, speed: '1–3 days', comment: 'Very professional and efficient. Highly recommend!', date: '2026-09-04', status: 'claimed' },
  { id: 6, user: 'Mark Dela Cruz',  avatar: 'MD', item: 'Keys (3 keys)',         category: 'Keys',       rating: 2, speed: '4–7 days', comment: 'Took too long, communication could be better.', date: '2026-09-03', status: 'claimed' },
  { id: 7, user: 'Nina Villanueva', avatar: 'NV', item: 'Red Umbrella',         category: 'Others',     rating: 4, speed: '1–3 days', comment: 'Happy with the result. Staff was very helpful.', date: '2026-09-02', status: 'claimed' },
  { id: 8, user: 'Jose Bautista',   avatar: 'JB', item: 'MacBook Charger',      category: 'Electronics',rating: 5, speed: 'Same day',  comment: 'Found within the same day of reporting. Excellent!', date: '2026-09-01', status: 'claimed' },
];

const SPEED_OPTIONS = ['All', 'Same day', '1–3 days', '4–7 days', '1+ week'];
const RATING_FILTER = ['All', '5 ⭐', '4 ⭐', '3 ⭐', '2 ⭐', '1 ⭐'];

function StarRow({ rating, max = 5, size = 16 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i < rating ? '#F59E0B' : 'none'}
          stroke={i < rating ? '#F59E0B' : 'var(--lr-icon, #9ca3af)'}
          strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ))}
    </span>
  );
}

function StatCard({ label, value, sub, icon, accent }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 dark:border-gray-700 p-5 flex items-start gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}18`, color: accent }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold lf-text-muted dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
        <p className="text-2xl font-bold lf-text-primary dark:text-white leading-tight">{value}</p>
        {sub && <p className="text-xs lf-text-muted dark:text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function RatingBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold lf-text-muted dark:text-gray-400 w-8 text-right flex-shrink-0">{label}</span>
      <div className="flex-1 h-2.5 rounded-full" style={{ background: 'var(--lf-30, #E5E7EB)' }}>
        <div className="h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs lf-text-muted dark:text-gray-400 w-8 flex-shrink-0">{count}</span>
    </div>
  );
}

export default function Feedback() {
  const [feedback, setFeedback] = useState([]);
  const [filterRating, setFilterRating] = useState('All');
  const [filterSpeed, setFilterSpeed]   = useState('All');
  const [search, setSearch]             = useState('');
  const [sortBy, setSortBy]             = useState('newest');
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState({ rating: 0, topic: '', comment: '' });
  const [formError, setFormError]       = useState('');
  const [submitted, setSubmitted]       = useState(false);

  useEffect(() => {
    // TODO: Replace with real API call when mobile feedback is live
    // e.g. fetch('/api/feedback').then(r => r.json()).then(setFeedback)
    setFeedback(SEED_FEEDBACK);
  }, []);

  /* ── Computed stats ── */
  const total       = feedback.length;
  const avgRating   = total ? (feedback.reduce((s, f) => s + f.rating, 0) / total).toFixed(1) : '—';
  const fiveStar    = feedback.filter(f => f.rating === 5).length;
  const sameDay     = feedback.filter(f => f.speed === 'Same day').length;
  const satisfaction= total ? Math.round((feedback.filter(f => f.rating >= 4).length / total) * 100) : 0;

  const ratingCounts = [5,4,3,2,1].map(r => ({
    star: r,
    count: feedback.filter(f => f.rating === r).length,
  }));

  const ratingColors = { 5:'#10B981', 4:'#34D399', 3:'#F59E0B', 2:'#FB923C', 1:'#EF4444' };

  /* ── Filtered + sorted list ── */
  const filtered = feedback
    .filter(f => filterRating === 'All' || f.rating === parseInt(filterRating))
    .filter(f => filterSpeed  === 'All' || f.speed === filterSpeed)
    .filter(f => {
      const q = search.toLowerCase();
      return !q || f.user.toLowerCase().includes(q) || f.item.toLowerCase().includes(q) || (f.comment||'').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'newest')        return new Date(b.date) - new Date(a.date);
      if (sortBy === 'oldest')        return new Date(a.date) - new Date(b.date);
      if (sortBy === 'rating-high')   return b.rating - a.rating;
      if (sortBy === 'rating-low')    return a.rating - b.rating;
      return 0;
    });

  const submitFeedback = (e) => {
    e.preventDefault();
    if (!form.rating || !form.topic || form.comment.trim().length < 10) {
      setFormError('Select a rating and topic, then enter at least 10 characters.');
      return;
    }
    setFeedback(current => [{
      id: Date.now(), user: 'You', avatar: 'YO', item: 'Web feedback', category: form.topic,
      rating: form.rating, speed: '—', comment: form.comment.trim(), date: new Date().toISOString().slice(0, 10), status: 'new'
    }, ...current]);
    setSubmitted(true); setFormError('');
  };

  return (
    <div className="max-w-6xl space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold lf-text-primary dark:text-white tracking-tight">
            User Feedback
          </h1>
          <p className="lf-text-muted dark:text-gray-400 text-sm mt-1">
            Ratings & comments from users after successful item returns
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live · {total} responses
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-bold lf-text-primary dark:text-white">Share your feedback</h2>
            <p className="text-xs lf-text-muted dark:text-gray-400 mt-1">Tell us what is working and where we can improve.</p>
          </div>
          {!showForm && !submitted && <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">Leave feedback</button>}
        </div>
        {showForm && !submitted && (
          <form onSubmit={submitFeedback} className="px-5 pb-5 border-t pt-5" style={{ borderColor: 'var(--lf-30-border, #E5E7EB)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold lf-text-primary dark:text-white mb-2">How was your experience? <span className="text-red-500">*</span></label>
                <div className="flex gap-2" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map(star => <button type="button" key={star} onClick={() => setForm({ ...form, rating: star })} aria-label={`${star} star${star > 1 ? 's' : ''}`} className={`w-10 h-10 rounded-lg border text-lg ${form.rating >= star ? 'border-amber-400 bg-amber-50 text-amber-500' : 'border-gray-200 text-gray-300'} hover:border-amber-400`}>★</button>)}
                </div>
              </div>
              <div>
                <label htmlFor="feedback-topic" className="block text-xs font-semibold lf-text-primary dark:text-white mb-2">Feedback topic <span className="text-red-500">*</span></label>
                <select id="feedback-topic" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm lf-text-primary dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-indigo-400" style={{ background: 'var(--lf-60, #fff)', borderColor: 'var(--lf-30-border)' }}>
                  <option value="">Choose a topic</option><option>Return process</option><option>Staff support</option><option>App experience</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="feedback-comment" className="block text-xs font-semibold lf-text-primary dark:text-white mb-2">Comments <span className="text-red-500">*</span></label>
              <textarea id="feedback-comment" rows="4" maxLength="500" value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} placeholder="Tell us what went well or what we can improve…" className="w-full px-3 py-2 rounded-lg border text-sm lf-text-primary dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-indigo-400 resize-none" style={{ background: 'var(--lf-60, #fff)', borderColor: 'var(--lf-30-border)' }} />
              <p className="text-[11px] text-right lf-text-muted dark:text-gray-500 mt-1">{form.comment.length}/500</p>
            </div>
            {formError && <p className="text-xs text-red-600 mt-3" role="alert">{formError}</p>}
            <div className="flex justify-end gap-2 mt-4"><button type="button" onClick={() => { setShowForm(false); setFormError(''); }} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium">Cancel</button><button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">Submit feedback</button></div>
          </form>
        )}
        {submitted && <div className="px-5 pb-5"><div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-center justify-between gap-3"><span><span className="font-bold">Feedback submitted.</span> Thank you for helping us improve.</span><button onClick={() => { setSubmitted(false); setShowForm(true); setForm({ rating: 0, topic: '', comment: '' }); }} className="text-xs font-semibold underline">Send another</button></div></div>}
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Average Rating"
          value={`${avgRating} / 5`}
          sub={<StarRow rating={Math.round(parseFloat(avgRating))} size={13} />}
          accent="#F59E0B"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
            </svg>
          }
        />
        <StatCard
          label="Satisfaction Rate"
          value={`${satisfaction}%`}
          sub="Ratings of 4★ or above"
          accent="#10B981"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          }
        />
        <StatCard
          label="Total Responses"
          value={total}
          sub={`${fiveStar} five-star reviews`}
          accent="#6366F1"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          }
        />
        <StatCard
          label="Same-Day Returns"
          value={sameDay}
          sub={`${total ? Math.round((sameDay/total)*100) : 0}% of all claims`}
          accent="#0EA5E9"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          }
        />
      </div>

      {/* ── Rating breakdown + filters row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Rating breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
          <h3 className="text-sm font-bold lf-text-primary dark:text-white">Rating Breakdown</h3>
          {ratingCounts.map(({ star, count }) => (
            <RatingBar
              key={star}
              label={`${star}★`}
              count={count}
              total={total}
              color={ratingColors[star]}
            />
          ))}
        </div>

        {/* Speed distribution */}
        <div className="bg-white rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="text-sm font-bold lf-text-primary dark:text-white mb-4">Return Speed</h3>
          <div className="space-y-3">
            {['Same day', '1–3 days', '4–7 days', '1+ week'].map(speed => {
              const count = feedback.filter(f => f.speed === speed).length;
              const pct   = total ? Math.round((count / total) * 100) : 0;
              const colors = { 'Same day': '#10B981', '1–3 days': '#F59E0B', '4–7 days': '#FB923C', '1+ week': '#EF4444' };
              return (
                <div key={speed} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors[speed] }} />
                    <span className="text-xs lf-text-muted dark:text-gray-400 truncate">{speed}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-20 h-2 rounded-full" style={{ background: 'var(--lf-30, #E5E7EB)' }}>
                      <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: colors[speed] }} />
                    </div>
                    <span className="text-xs font-semibold lf-text-primary dark:text-white w-6 text-right">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Highlight card */}
        <div className="bg-white rounded-xl border border-gray-100 dark:border-gray-700 p-5 flex flex-col justify-between">
          <h3 className="text-sm font-bold lf-text-primary dark:text-white mb-3">Top Comment</h3>
          {feedback.filter(f => f.rating === 5 && f.comment).slice(0,1).map(f => (
            <div key={f.id}>
              <p className="text-sm lf-text-primary dark:text-gray-200 italic leading-relaxed mb-3">
                "{f.comment}"
              </p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#F59E0B,#FBBF24)' }}>
                  {f.avatar}
                </div>
                <div>
                  <p className="text-xs font-semibold lf-text-primary dark:text-white">{f.user}</p>
                  <StarRow rating={f.rating} size={11} />
                </div>
              </div>
            </div>
          ))}
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--lf-30-border, #E5E7EB)' }}>
            <p className="text-xs lf-text-muted dark:text-gray-400">
              ✨ Based on {fiveStar} five-star reviews
            </p>
          </div>
        </div>
      </div>

      {/* ── Feedback list ── */}
      <div className="bg-white rounded-xl border border-gray-100 dark:border-gray-700">

        {/* List header + controls */}
        <div className="p-5 border-b" style={{ borderColor: 'var(--lf-30-border, #E5E7EB)' }}>
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <h3 className="text-sm font-bold lf-text-primary dark:text-white">All Feedback</h3>
            <div className="flex flex-wrap items-center gap-2">

              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 lf-text-muted dark:text-gray-400"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search user, item…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border dark:border-gray-600 outline-none focus:ring-2 focus:ring-amber-400 lf-text-primary dark:text-white"
                  style={{ background: 'var(--lf-60, #fff)', borderColor: 'var(--lf-30-border)' }}
                />
              </div>

              {/* Rating filter */}
              <select
                value={filterRating}
                onChange={e => setFilterRating(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-amber-400 lf-text-primary dark:text-white dark:border-gray-600"
                style={{ background: 'var(--lf-60, #fff)', borderColor: 'var(--lf-30-border)' }}
              >
                {RATING_FILTER.map(r => (
                  <option key={r} value={r === 'All' ? 'All' : r.charAt(0)}>{r}</option>
                ))}
              </select>

              {/* Speed filter */}
              <select
                value={filterSpeed}
                onChange={e => setFilterSpeed(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-amber-400 lf-text-primary dark:text-white dark:border-gray-600"
                style={{ background: 'var(--lf-60, #fff)', borderColor: 'var(--lf-30-border)' }}
              >
                {SPEED_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-amber-400 lf-text-primary dark:text-white dark:border-gray-600"
                style={{ background: 'var(--lf-60, #fff)', borderColor: 'var(--lf-30-border)' }}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="rating-high">Rating: High → Low</option>
                <option value="rating-low">Rating: Low → High</option>
              </select>
            </div>
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y dark:divide-gray-700" style={{ '--tw-divide-color': 'var(--lf-30-border)' }}>
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-10 h-10 mx-auto lf-text-muted dark:text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              <p className="text-sm lf-text-muted dark:text-gray-400">No feedback matches your filters</p>
            </div>
          ) : filtered.map(f => (
            <div key={f.id} className="p-4 sm:p-5 flex items-start gap-4 hover:opacity-90 transition-opacity">

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                {f.avatar}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                  <span className="text-sm font-semibold lf-text-primary dark:text-white">{f.user}</span>
                  <StarRow rating={f.rating} size={13} />
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: f.speed === 'Same day' ? 'rgba(16,185,129,0.12)' : f.speed === '1–3 days' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.1)',
                      color:      f.speed === 'Same day' ? '#059669' : f.speed === '1–3 days' ? '#B45309' : '#DC2626'
                    }}>
                    ⏱ {f.speed}
                  </span>
                </div>
                <p className="text-xs lf-text-muted dark:text-gray-400 mb-1">
                  Item: <span className="font-medium lf-text-primary dark:text-gray-200">{f.item}</span>
                  <span className="mx-1.5">·</span>
                  {f.category}
                </p>
                {f.comment && (
                  <p className="text-sm lf-text-muted dark:text-gray-300 leading-relaxed">"{f.comment}"</p>
                )}
              </div>

              {/* Date */}
              <span className="text-xs lf-text-muted dark:text-gray-500 flex-shrink-0 mt-0.5">
                {new Date(f.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t text-xs lf-text-muted dark:text-gray-400 flex items-center justify-between"
            style={{ borderColor: 'var(--lf-30-border, #E5E7EB)' }}>
            <span>Showing {filtered.length} of {total} responses</span>
            <span className="italic">📌 Data from mobile app · Updates automatically</span>
          </div>
        )}
      </div>

    </div>
  );
}
