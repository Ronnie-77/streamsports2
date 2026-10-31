import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

/**
 * Cricket bat icon — copied from sportplus.watch sprite (icon-cricket).
 * Shows a bat, ball, and stumps silhouette. viewBox 0 0 16 16.
 */
export function CricketBatIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      {...props}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="m3.886 8.982 2.916 2.911 8.482-8.477A4.19 4.19 0 0 0 12.368.5zm.194-6.037a1.79 1.79 0 1 1-3.581 0 1.79 1.79 0 0 1 3.581 0m.563 9.771a1.29 1.29 0 0 1 1.167-.379l-2.231-2.21a1.27 1.27 0 0 1-.307 1.238L.74 13.898a.77.77 0 0 0 0 1.1l.271.276a.78.78 0 0 0 1.1 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Football (soccer ball) icon — copied from sportplus.watch sprite (icon-football).
 * Classic pentagon-hexball pattern. viewBox 0 0 16 16.
 */
export function FootballBallIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      {...props}
    >
      <path
        fill="currentColor"
        d="M8 1C4.14 1 1 4.14 1 8s3.14 7 7 7 7-3.14 7-7-3.14-7-7-7m.445 2.274 1.8-.968a6.15 6.15 0 0 1 2.528 1.863l-.429 1.98-1.373.673-2.526-1.84zm-2.674-.973 1.8.971v1.71l-2.525 1.84-1.38-.674-.428-1.992A6.15 6.15 0 0 1 5.771 2.3m-2.82 9.16a6.1 6.1 0 0 1-1.045-2.865l1.481-1.609 1.351.661 1.018 2.89-.86 1.031zm6.609 2.456a6 6 0 0 1-1.56.209 6.1 6.1 0 0 1-1.871-.295l-.55-1.713.877-1.054h3.092l.862 1.02zm1.532-2.378-.846-1.002 1.032-2.889 1.345-.659 1.472 1.608a6.1 6.1 0 0 1-.827 2.51"
      />
    </svg>
  );
}
