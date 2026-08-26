/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, ZoomIn, ZoomOut, RotateCw, Trash2, Check, X, Upload, AlertCircle } from 'lucide-react';
import { useBackdropHistory } from '../hooks/useBackdropHistory';

interface PhotoCropperModalProps {
  isOpen: boolean;
  initialImageUrl?: string;
  currentLanguage: 'sl' | 'en';
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
  onRemovePhoto?: () => void;
}

export default function PhotoCropperModal({
  isOpen,
  initialImageUrl,
  currentLanguage,
  onClose,
  onCropComplete,
  onRemovePhoto,
}: PhotoCropperModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(initialImageUrl || null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Reset state when opening modal
  useEffect(() => {
    if (isOpen) {
      setImageSrc(initialImageUrl || null);
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setErrorMsg('');
    }
  }, [isOpen, initialImageUrl]);

  // Load image object whenever imageSrc changes
  useEffect(() => {
    if (!imageSrc) {
      imageRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setPosition({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Handle File Upload with 10MB limit
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 10 MB = 10 * 1024 * 1024 bytes
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMsg(
        currentLanguage === 'sl'
          ? 'Slika presega največjo dovoljeno velikost 10 MB.'
          : 'Image exceeds maximum allowed size of 10 MB.'
      );
      return;
    }

    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageSrc(reader.result);
        setZoom(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
      }
    };
    reader.readAsDataURL(file);
  };

  // Dragging logic for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageSrc) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch support for mobile dragging
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!imageSrc || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  // Export 250x250 Lightweight Cropped Canvas (~15-20 KB)
  const handleApplyCrop = () => {
    let img = imageRef.current;
    
    const proceedWithCrop = (sourceImg: HTMLImageElement) => {
      try {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = 250;
        exportCanvas.height = 250;
        const ctx = exportCanvas.getContext('2d');
        if (!ctx) return;

        // Clear background
        ctx.clearRect(0, 0, 250, 250);

        // Fill background with clean white
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 250, 250);

        // Translate to canvas center (125, 125)
        ctx.translate(125, 125);

        // Rotate
        ctx.rotate((rotation * Math.PI) / 180);

        // Scaling factor (Preview container is 240px, output canvas is 250px)
        const previewSize = 240;
        const scaleFactor = 250 / previewSize;

        const imgAspect = (sourceImg.width || 1) / (sourceImg.height || 1);
        let baseW = previewSize;
        let baseH = previewSize;
        if (imgAspect >= 1) {
          baseW = previewSize * imgAspect;
        } else {
          baseH = previewSize / imgAspect;
        }

        const drawWidth = baseW * zoom * scaleFactor;
        const drawHeight = baseH * zoom * scaleFactor;
        const drawX = (position.x * scaleFactor) - (drawWidth / 2);
        const drawY = (position.y * scaleFactor) - (drawHeight / 2);

        ctx.drawImage(sourceImg, drawX, drawY, drawWidth, drawHeight);

        // Export as ultra-lightweight JPEG (250x250 compressed ~12-18KB)
        const croppedDataUrl = exportCanvas.toDataURL('image/jpeg', 0.80);
        onCropComplete(croppedDataUrl);
        onClose();
      } catch (err: any) {
        console.warn('Crop canvas export fallback:', err);
        if (imageSrc) {
          onCropComplete(imageSrc);
          onClose();
        }
      }
    };

    if (img && img.complete) {
      proceedWithCrop(img);
    } else if (imageSrc) {
      const fallbackImg = new Image();
      fallbackImg.crossOrigin = 'anonymous';
      fallbackImg.onload = () => proceedWithCrop(fallbackImg);
      fallbackImg.onerror = () => {
        onCropComplete(imageSrc);
        onClose();
      };
      fallbackImg.src = imageSrc;
    }
  };

  useBackdropHistory(isOpen, onClose, 'photo-cropper-modal');

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in"
    >
      <div 
        className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-scale-up"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-150 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <h3 className="font-display font-semibold text-gray-900 text-sm">
              {currentLanguage === 'sl' ? 'Uredi profilno sliko' : 'Edit Profile Photo'}
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 flex flex-col items-center">
          {errorMsg && (
            <div className="w-full p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/jpg, image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          {imageSrc ? (
            <>
              {/* Interactive Circular Preview Box */}
              <div className="space-y-2 text-center w-full flex flex-col items-center">
                <p className="text-[11px] text-slate-500 font-mono">
                  💡 {currentLanguage === 'sl' ? 'Povlecite sliko za premikanje & prilagodite povečavo' : 'Drag image to position & adjust zoom'}
                </p>

                <div 
                  className="relative w-60 h-60 rounded-full border-4 border-indigo-500/80 shadow-inner overflow-hidden cursor-move bg-slate-900 select-none flex items-center justify-center"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleMouseUp}
                >
                  <img
                    src={imageSrc}
                    alt="Preview"
                    draggable={false}
                    className="max-w-none transition-transform duration-75"
                    style={{
                      transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
                  />

                  {/* Circular Overlay Ring */}
                  <div className="absolute inset-0 rounded-full border-2 border-white/60 pointer-events-none shadow-[0_0_0_9999px_rgba(15,23,42,0.4)]" />
                </div>
              </div>

              {/* Controls: Zoom & Rotate */}
              <div className="w-full space-y-3 pt-1">
                {/* Zoom Slider */}
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />
                </div>

                {/* Rotate & Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setRotation((prev) => (prev + 90) % 360)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>{currentLanguage === 'sl' ? 'Zavrti' : 'Rotate'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{currentLanguage === 'sl' ? 'Zamenjaj' : 'Change'}</span>
                  </button>

                  {onRemovePhoto && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageSrc(null);
                        onRemovePhoto();
                        onClose();
                      }}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{currentLanguage === 'sl' ? 'Odstrani' : 'Remove'}</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Upload Initial Placeholder */
            <div className="w-full py-8 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-3 bg-slate-50 hover:bg-slate-100/80 transition cursor-pointer"
                 onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1 px-4">
                <p className="text-xs font-bold text-slate-800">
                  {currentLanguage === 'sl' ? 'Naložite fotografijo sodelavca' : 'Upload Volunteer Photo'}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  JPG, PNG, WEBP (Maks. 10 MB) • Avtomatsko obrezano na 300x300
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-150 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-lg transition"
          >
            {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
          </button>

          {imageSrc && (
            <button
              type="button"
              onClick={handleApplyCrop}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{currentLanguage === 'sl' ? 'Shrani sliko (300x300)' : 'Save Photo (300x300)'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
