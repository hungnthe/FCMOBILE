import React, { useState, useEffect } from 'react';
import { X, Sparkles, Save } from 'lucide-react';
import confetti from 'canvas-confetti';
import PlayerCard from './PlayerCard';

export default function PlayerModal({ isOpen, onClose, onSave, playerToEdit }) {
  const defaultFormData = {
    name: '',
    rating: 88,
    position: 'ST',
    nation: 'France',
    club: 'Real Madrid',
    pac: 85,
    sho: 85,
    pas: 80,
    dri: 85,
    def: 50,
    phy: 78,
    cardType: 'Gold',
    photoUrl: '',
    matches: 0,
    goals: 0,
    assists: 0,
    motm: 0
  };

  const [formData, setFormData] = useState(defaultFormData);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (playerToEdit) {
      setFormData(playerToEdit);
    } else {
      setFormData(defaultFormData);
    }
  }, [playerToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await onSave({
        name: formData.name,
        ovr: Number(formData.rating) || 0,
        position: [String(formData.position || 'ST').toLowerCase()],
        nation: formData.nation,
        program: formData.club ? [formData.club] : [],
        Status_I_H_M: formData.cardType,
        stats: {
          match: Number(formData.matches) || 0,
          goalAmounts: Number(formData.goals) || 0,
          assistAmounts: Number(formData.assists) || 0,
          bestPlayerAmount: Number(formData.motm) || 0,
          sessionAmount: 0
        },
        imageCard: formData.photoUrl ? [formData.photoUrl] : [],
        active: { HTH: [], lastWeekCup: 0 },
        metadata: { note: '' }
      });
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const sampleAvatars = [
    { label: 'Mbappe', url: 'https://images.unsplash.com/photo-1543351611-c82399575a20?auto=format&fit=crop&w=400&q=80' },
    { label: 'Bellingham', url: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=400&q=80' },
    { label: 'Ronaldo', url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=400&q=80' },
    { label: 'Messi', url: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=400&q=80' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn overflow-y-auto font-sans">
      
      <div className="relative w-full max-w-4xl bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-2xl my-8 text-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-50 text-red-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-black text-2xl text-red-600">
                {playerToEdit ? 'EDIT FOOTBALL PLAYER' : 'ADD NEW FOOTBALL PLAYER'}
              </h2>
              <p className="text-xs text-slate-500">Configure player data, stats, attributes, and photo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Player Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Lamine Yamal"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Position *</label>
                <select
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                >
                  <option value="ST">ST - Striker</option>
                  <option value="RW">RW - Right Wing</option>
                  <option value="LW">LW - Left Wing</option>
                  <option value="CAM">CAM - Attacking Mid</option>
                  <option value="CM">CM - Central Mid</option>
                  <option value="CDM">CDM - Defensive Mid</option>
                  <option value="CB">CB - Center Back</option>
                  <option value="LB">LB - Left Back</option>
                  <option value="RB">RB - Right Back</option>
                  <option value="GK">GK - Goalkeeper</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Overall Rating (OVR)</label>
                <input
                  type="number"
                  name="rating"
                  min="40"
                  max="199"
                  value={formData.rating}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-red-600 font-bold focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Card Theme</label>
                <select
                  name="cardType"
                  value={formData.cardType}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                >
                  <option value="Gold">Gold Rare</option>
                  <option value="TOTY">TOTY (Team Of The Year)</option>
                  <option value="Icon">Icon</option>
                  <option value="Futties">Futties</option>
                  <option value="Hero">Hero</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nation / Country</label>
                <input
                  type="text"
                  name="nation"
                  value={formData.nation}
                  onChange={handleChange}
                  placeholder="e.g. France"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Club</label>
                <input
                  type="text"
                  name="club"
                  value={formData.club}
                  onChange={handleChange}
                  placeholder="e.g. Real Madrid"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                <span>Photo URL</span>
                <span className="text-[10px] text-red-600">Sample Avatars</span>
              </label>
              <input
                type="text"
                name="photoUrl"
                value={formData.photoUrl || ''}
                onChange={handleChange}
                placeholder="https://images.unsplash.com/..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-red-500 mb-2"
              />
              <div className="flex gap-2">
                {sampleAvatars.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, photoUrl: sample.url }))}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-200 transition"
                  >
                    Preset {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Performance Stats */}
            <div className="pt-2">
              <span className="block text-xs font-bold text-red-600 uppercase tracking-wider mb-2">
                Performance Records
              </span>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { key: 'matches', label: 'MATCHES' },
                  { key: 'goals', label: 'GOALS' },
                  { key: 'assists', label: 'ASSISTS' },
                  { key: 'motm', label: 'BEST WINS' },
                ].map((item) => (
                  <div key={item.key} className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <label className="block text-[10px] font-bold text-slate-500">{item.label}</label>
                    <input
                      type="number"
                      name={item.key}
                      min="0"
                      value={formData[item.key]}
                      readOnly
                      aria-label={`${item.label} derived from seasons`}
                      className="w-full bg-transparent text-center font-display font-bold text-sm text-slate-900 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 text-white font-extrabold text-sm hover:bg-red-700 transition shadow-md"
              >
                <Save className="w-4 h-4" />
                <span>{submitting ? 'Saving...' : playerToEdit ? 'Save Changes' : 'Create Player'}</span>
              </button>
            </div>

          </form>

          {/* Live Card Preview Column */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-xs font-extrabold text-red-600 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> LIVE CARD PREVIEW
            </span>
            <PlayerCard player={formData} />
          </div>

        </div>

      </div>

    </div>
  );
}
