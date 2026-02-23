import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          borderRadius: 36,
        }}
      >
        <span
          style={{
            fontSize: 96,
            fontWeight: 700,
            color: '#14b8a6',
            letterSpacing: '-0.02em',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          H
        </span>
      </div>
    ),
    { ...size }
  );
}
