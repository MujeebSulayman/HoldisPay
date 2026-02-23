import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 8,
        }}
      >
        <span
          style={{
            fontSize: 20,
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
