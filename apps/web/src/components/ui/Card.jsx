export const Card = ({ as: Tag = 'div', className = '', ...rest }) => (
  <Tag className={`card ${className}`.trim()} {...rest} />
);
