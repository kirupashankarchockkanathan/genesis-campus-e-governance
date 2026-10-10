import { Link } from 'react-router-dom';

/** variant: primary | secondary | light | danger | link. Renders a router Link when `to` is set. */
export function Button({ variant = 'primary', to, className = '', type = 'button', ...rest }) {
  const cls = `btn btn-${variant} ${className}`.trim();
  if (to) return <Link className={cls} to={to} {...rest} />;
  return <button className={cls} type={type} {...rest} />;
}
