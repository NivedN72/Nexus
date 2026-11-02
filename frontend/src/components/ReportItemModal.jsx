import ModalShell from './ModalShell';
import React, { useState } from 'react';
import { X, Upload, Backpack, Search, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { validatePhoto } from '../utils/uploads';

export default function ReportItemModal({ isOpen, onClose, currentUser, onItemReported }) {
  const [type, setType] = useState('lost');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingPhoto, setCheckingPhoto] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const input = e.target;
    const selected = input.files[0];
    setFile(null);
    setPreview(null);
    if (!selected) return;
    setCheckingPhoto(true);
    try {
      await validatePhoto(selected);
      // The user may select a different file while its signature is being checked.
      if (input.files[0] !== selected) return;
      setFile(selected);
      setError('');
      const reader = new FileReader();
      reader.onload = () => { if (input.files[0] === selected) setPreview(reader.result); };
      reader.readAsDataURL(selected);
    } catch (err) {
      if (input.files[0] !== selected) return;
      input.value = '';
      setError(err.message);
    } finally {
      setCheckingPhoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (checkingPhoto || loading) return;
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
        ...(file ? { fileType: file.type, fileSize: file.size } : {}),
      };

      const result = await api.reportItem(reportData, currentUser);

      if (file && (result.upload || result.uploadUrl)) {
        setStatusMessage('2/3: Uploading photo directly to S3 via pre-signed URL...');
        await api.uploadPhotoToS3(result.upload || result.uploadUrl, file);

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
    <ModalShell label="Student community" title="Lost. Found. Connected." description="A photo, a few details, and a better chance of a reunion." className="nexus-dialog-reportitem">
        
        {/* Close Button */}
        <button
          aria-label="Close student community"
          onClick={onClose}
          className="absolute top-5 right-5 text-muted hover:text-ink transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-accent/30 flex items-center justify-center text-accent-ink">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">Report Lost / Found Item</h2>
            <p className="text-xs text-muted">AWS Rekognition will automatically analyze the photo</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-danger/15 border border-danger/25 text-danger text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Item Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
              Report Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('lost')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                  type === 'lost'
                    ? 'bg-warning/20 text-warning border-warning/25 shadow-none'
                    : 'bg-soft text-muted border-line hover:bg-surface'
                }`}
              >
                <Backpack className="w-4 h-4 inline-block mr-2" />I Lost Something
              </button>
              <button
                type="button"
                onClick={() => setType('found')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                  type === 'found'
                    ? 'bg-success/20 text-success border-success/25 shadow-none'
                    : 'bg-soft text-muted border-line hover:bg-surface'
                }`}
              >
                <Search className="w-4 h-4 inline-block mr-2" />I Found Something
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Item Title *</label>
            <input
              type="text"
              placeholder="e.g. Black Nike Backpack, Blue Water Bottle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-soft border border-line rounded-xl px-3.5 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:border-accent-ink/25"
              maxLength={160}
              required
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Campus Location *</label>
            <input
              type="text"
              placeholder="e.g. Library 2nd Floor, Main Cafeteria"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-soft border border-line rounded-xl px-3.5 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:border-accent-ink/25"
              maxLength={200}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Details & Description</label>
            <textarea
              rows="2"
              maxLength={2000}
              placeholder="Any distinguishing marks, colors, contents..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-soft border border-line rounded-xl px-3.5 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:border-accent-ink/25 resize-none"
            ></textarea>
          </div>

          {/* Photo Upload with Pre-signed URL explanation */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Item Photo (JPEG or PNG, up to 5 MB)
            </label>
            
            <div className="relative border-2 border-dashed border-line hover:border-accent-ink/50 rounded-xl p-4 text-center cursor-pointer bg-soft transition-colors">
              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              {preview ? (
                <div className="flex items-center gap-3">
                  <img src={preview} alt="Preview" className="w-14 h-14 rounded-lg object-cover border border-line" />
                  <div className="text-left text-xs">
                    <p className="font-semibold text-ink">{file?.name}</p>
                    <p className="text-muted">{(file?.size / 1024).toFixed(1)} KB — Ready for S3 upload</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-2 text-muted">
                  <Upload className="w-6 h-6 mb-1.5 text-accent-ink" />
                  <p className="text-xs font-medium text-ink">Click or drag photo here</p>
                  <p className="text-[11px] text-muted">Direct S3 upload via pre-signed URL</p>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || checkingPhoto}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-accent    hover:bg-accent-hover hover:bg-accent-hover text-ink shadow-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-line border-t-ink rounded-full animate-spin"></span>
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
    </ModalShell>
  );
}
