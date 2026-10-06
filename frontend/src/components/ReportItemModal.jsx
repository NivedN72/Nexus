import React, { useState } from 'react';
import { X, Upload, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export default function ReportItemModal({ isOpen, onClose, currentUser, onItemReported }) {
  const [type, setType] = useState('lost');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    if (selected.name.toLowerCase().endsWith('.heic')) {
      setError('iPhone HEIC format is not supported by AWS Rekognition. Please use JPEG or PNG.');
      return;
    }

    setFile(selected);
    setError('');
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(selected);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !location.trim()) {
      setError('Title and location are required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setStatusMessage('1/3: Registering item in DynamoDB...');

      const reportData = {
        type,
        title: title.trim(),
        location: location.trim(),
        description: description.trim(),
        fileType: file ? file.type || 'image/jpeg' : 'image/jpeg',
      };

      const result = await api.reportItem(reportData, currentUser);

      if (file && result.uploadUrl) {
        setStatusMessage('2/3: Uploading photo directly to S3 via pre-signed URL...');
        await api.uploadPhotoToS3(result.uploadUrl, file);

        setStatusMessage('3/3: S3 event triggered! AWS Rekognition is auto-tagging...');
      }

      setTimeout(() => {
        setLoading(false);
        onItemReported();
        onClose();
      }, 1000);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to submit report');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-lg rounded-2xl p-6 border border-white/10 shadow-2xl relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Report Lost / Found Item</h2>
            <p className="text-xs text-slate-400">AWS Rekognition will automatically analyze the photo</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Item Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Report Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('lost')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  type === 'lost'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
                    : 'bg-slate-900/60 text-slate-400 border-white/5 hover:bg-white/5'
                }`}
              >
                🎒 I Lost Something
              </button>
              <button
                type="button"
                onClick={() => setType('found')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  type === 'found'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                    : 'bg-slate-900/60 text-slate-400 border-white/5 hover:bg-white/5'
                }`}
              >
                🔍 I Found Something
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Item Title *</label>
            <input
              type="text"
              placeholder="e.g. Black Nike Backpack, Blue Water Bottle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Campus Location *</label>
            <input
              type="text"
              placeholder="e.g. Library 2nd Floor, Main Cafeteria"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Details & Description</label>
            <textarea
              rows="2"
              placeholder="Any distinguishing marks, colors, contents..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            ></textarea>
          </div>

          {/* Photo Upload with Pre-signed URL explanation */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Item Photo (JPG or PNG for AWS Rekognition)
            </label>
            
            <div className="relative border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-xl p-4 text-center cursor-pointer bg-slate-900/40 transition-colors">
              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              {preview ? (
                <div className="flex items-center gap-3">
                  <img src={preview} alt="Preview" className="w-14 h-14 rounded-lg object-cover border border-white/10" />
                  <div className="text-left text-xs">
                    <p className="font-semibold text-white">{file?.name}</p>
                    <p className="text-slate-400">{(file?.size / 1024).toFixed(1)} KB — Ready for S3 upload</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-2 text-slate-400">
                  <Upload className="w-6 h-6 mb-1.5 text-indigo-400" />
                  <p className="text-xs font-medium text-slate-200">Click or drag photo here</p>
                  <p className="text-[11px] text-slate-500">Direct S3 upload via pre-signed URL</p>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>{statusMessage}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Submit Report & Trigger AI Recognition
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
