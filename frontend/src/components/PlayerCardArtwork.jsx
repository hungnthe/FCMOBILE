import React, { useState } from 'react';
import { ShieldAlert, Award } from 'lucide-react';

/**
 * Format asset path for browser:
 * 'public/ImageCard/...' -> '/ImageCard/...'
 */
export function formatCardImageUrl(value) {
  if (!value) return '';
  const source = Array.isArray(value) ? value[0] : value;
  if (typeof source !== 'string') return '';
  const trimmed = source.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('public/') ? `/${trimmed.slice(7)}` : trimmed;
}

/**
 * Shared Player Card Artwork Component
 * Ensures:
 * - Full card artwork is visible (object-fit: contain)
 * - Proportions preserved, never stretched, never cropped to circle
 * - Descriptive alt text (Player Name + Season Name)
 * - Safe aspect-ratio container to prevent layout shift
 * - Neutral fallback placeholder when image is missing or errors
 * - Lazy load on lists, eager on detail
 */
export default function PlayerCardArtwork({
  src,
  playerName = 'Cầu thủ',
  seasonName = 'Mùa thẻ',
  height = 160,
  priority = false,
  className = '',
  style = {}
}) {
  const [hasError, setHasError] = useState(false);
  const formattedUrl = formatCardImageUrl(src);
  const showFallback = !formattedUrl || hasError;

  return (
    <div
      className={`player-card-artwork-frame ${className}`}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        aspectRatio: '170 / 240',
        ...style
      }}
      data-player={playerName}
      data-season={seasonName}
    >
      {!showFallback ? (
        <img
          src={formattedUrl}
          alt={`${playerName} - ${seasonName || 'Mùa thẻ'}`}
          className="player-card-artwork-img"
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="player-card-artwork-placeholder" role="img" aria-label={`Chưa có ảnh mùa thẻ cho ${playerName}`}>
          <div className="artwork-placeholder-icon">
            <Award className="w-8 h-8 opacity-60" />
          </div>
          <span className="artwork-placeholder-title">Chưa có ảnh mùa thẻ</span>
          <span className="artwork-placeholder-name" title={playerName}>{playerName}</span>
          {seasonName && seasonName !== '—' && (
            <span className="artwork-placeholder-season" title={seasonName}>{seasonName}</span>
          )}
        </div>
      )}
    </div>
  );
}
