import { avatarColor, initials } from '../lib/format';

interface AvatarProps {
  title: string;
  seed: string;
  size?: number;
}

export function Avatar({ title, seed, size = 48 }: AvatarProps) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, background: avatarColor(seed), fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(title)}
    </div>
  );
}
