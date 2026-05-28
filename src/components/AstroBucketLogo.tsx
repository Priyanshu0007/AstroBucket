import React from 'react';

/**
 * AstroBucketLogoProps
 * 
 * Custom properties for the branding logo.
 * - size: Sizing indicator (width/height dimensions).
 */
interface AstroBucketLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const AstroBucketLogo: React.FC<AstroBucketLogoProps> = ({ 
  size = 32, 
  className = '', 
  ...props 
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="astroBucketLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="ringLogoGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Ambient Glow Background Element */}
      <circle cx="256" cy="256" r="220" fill="url(#astroBucketLogoGrad)" opacity="0.12" filter="url(#logoGlow)" />

      {/* The Cosmic Bucket (Outer Shape) */}
      <path 
        d="M160 190 L352 190 L320 400 C318 416, 304 428, 288 428 L224 428 C208 428, 194 416, 192 400 Z" 
        fill="url(#astroBucketLogoGrad)" 
        stroke="#ffffff" 
        strokeWidth="12" 
        strokeLinejoin="round" 
      />

      {/* Rim of the Bucket */}
      <ellipse cx="256" cy="190" rx="96" ry="22" fill="#07070a" stroke="#ffffff" strokeWidth="12" />

      {/* Orbital Ring (Astro space orbit representation) */}
      <path 
        d="M100 280 C60 250, 60 210, 160 190 C180 186, 210 184, 256 184" 
        fill="none" 
        stroke="url(#ringLogoGrad)" 
        strokeWidth="16" 
        strokeLinecap="round" 
        opacity={0.8} 
      />
      
      <path 
        d="M256 184 C330 184, 450 190, 412 250 C380 300, 240 330, 100 280" 
        fill="none" 
        stroke="url(#ringLogoGrad)" 
        strokeWidth="16" 
        strokeLinecap="round" 
      />

      {/* Stars rising from the bucket */}
      {/* Main Star */}
      <path 
        d="M256 100 L262 120 L282 120 L266 132 L272 152 L256 140 L240 152 L246 132 L230 120 L250 120 Z" 
        fill="#ffffff" 
        filter="url(#logoGlow)" 
      />
      
      {/* Small Star Left */}
      <path 
        d="M185 135 L188 143 L196 143 L190 148 L192 156 L185 151 L178 156 L180 148 L174 143 L182 143 Z" 
        fill="#60a5fa" 
      />
      
      {/* Small Star Right */}
      <path 
        d="M325 125 L328 133 L336 133 L330 138 L332 146 L325 141 L318 146 L320 138 L314 133 L322 133 Z" 
        fill="#a855f7" 
      />

      {/* Particle details floating */}
      <circle cx="210" cy="250" r="8" fill="#ffffff" opacity={0.8} />
      <circle cx="300" cy="270" r="6" fill="#ffffff" opacity={0.6} />
      <circle cx="230" cy="340" r="10" fill="#ffffff" opacity={0.5} />
      <circle cx="280" cy="310" r="8" fill="#ffffff" opacity={0.7} />
    </svg>
  );
};
